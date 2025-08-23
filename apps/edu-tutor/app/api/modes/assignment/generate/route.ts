import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { ASSIGNMENT_GENERATE_PROMPT_NDJSON, IT_TUTOR_SYSTEM_PROMPT, ASSIGNMENT_MODE_USER_GUIDANCE } from '@/lib/prompts'
import { AssignmentRequestSchema } from '@/lib/schemas/modes'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'
import { createStreamingChatCompletion } from '@/lib/llm'

// Note: JSON extraction for model outputs is handled inline where required

  interface MinimalVariant {
    id?: string
    title?: string
    objectives?: string[]
    scenario?: string
    steps?: string[]
    deliverables?: string[]
    rubric?: unknown
    hints?: string[]
    stretchGoals?: string[]
  }

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Assignment generation request:', { requestId, timestamp: new Date().toISOString() })

  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded:', { requestId, ip: clientIP })
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const parsed = AssignmentRequestSchema.parse(body)

    // Content moderation
    const moderation = await preModerate(parsed.topic, { maxLength: 200 })
    if (!moderation.allowed) {
      console.log('Content blocked by moderation:', { requestId, reason: moderation.reason })
      return NextResponse.json(
        { error: moderation.reason || 'Content not allowed' },
        { status: 400 }
      )
    }

    // IT content validation
    const validation = await validateITContent(parsed.topic, 'assignment')
    if (!validation.isValid) {
      console.log('IT content validation failed:', { requestId, errors: validation.errors })
      return NextResponse.json(
        { error: validation.errors[0] || 'Content validation failed' },
        { status: 400 }
      )
    }

  // Build context for assignment generation
  let contextText = ''
  if (parsed.constraints) {
    // include constraints inline in the prompt when present
    contextText += `\nConstraints: ${JSON.stringify(parsed.constraints)}`
  }

    const guidanceNote = parsed.guidanceStyle === 'solutions' 
      ? '\nInclude solution outline in the response for each variant.'
      : '\nProvide hints but avoid full solutions unless specifically requested.'

  // Default number of variants to generate when not provided by client
  const count = parsed.count || 1

    // Include additional requirements if provided
    const extra = (parsed && typeof parsed === 'object' && 'additionalRequirements' in parsed && parsed.additionalRequirements)
      ? `\nAdditional requirements: ${(parsed as unknown as Record<string, unknown>).additionalRequirements}`
      : ''

  // Use NDJSON prompt for streaming-friendly output and include user-provided assignment-mode guidance (additive)
  // Explicitly ignore any timeBudgetHrs value from client input to avoid large default assignments
  if ('timeBudgetHrs' in (parsed as Record<string, unknown>)) {
    try { delete (parsed as Record<string, unknown>).timeBudgetHrs } catch {
      // Ignore errors when deleting optional client-provided fields
    }
  }
  const prompt = `${ASSIGNMENT_GENERATE_PROMPT_NDJSON}

${ASSIGNMENT_MODE_USER_GUIDANCE}

Topic: ${parsed.topic}
Difficulty: ${parsed.difficulty}${guidanceNote}${extra}

${contextText}
Produce ${count} variants as NDJSON per the instructions above.`

  // Runtime tightening: explicitly instruct the model about strict size and field limits
  // This reinforces the constraints declared in lib/prompts.ts and helps avoid oversized final payloads.
  const sizeConstraints = `
STRICT_SIZE_LIMITS (MUST FOLLOW):
- Each full variant object MUST be <= 300 words total across all text fields.
- Streaming 'assignment' summaries MUST be <= 40 words.
- Limits: objectives <= 5, steps <= 8, deliverables <= 5, hints <= 3, stretchGoals <= 2.
- Rubric: at most 5 criteria; each level description <= 20 words; weights must sum to 1.0.
- Use concise, bullet-like text. If a field would exceed limits, truncate it and add a boolean field 'truncated': true in that variant.
`

  const finalPrompt = `${prompt}\n${sizeConstraints}`

    console.log('Generating assignments:', { 
      requestId, 
      topic: parsed.topic, 
      difficulty: parsed.difficulty,
      guidanceStyle: parsed.guidanceStyle 
    })

    // Streamable implementation: return NDJSON stream of events (assignment summaries, progress, final full_set)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ''
  const fullVariants: Array<Record<string, unknown>> = []

        function flushBufferAsJsonLines() {
          // Fast path: treat the buffer as NDJSON and process complete lines in a single pass.
          // This avoids repeated indexOf/brace-scanning loops that are costly when chunks are small.
          if (!buffer.includes('\n')) return

          const parts = buffer.split('\n')
          // The last part may be an incomplete fragment — keep it in buffer
          buffer = parts.pop() || ''

          for (const rawLine of parts) {
            const line = rawLine.trim()
            if (!line) continue

            // Strip surrounding ```json fences if present
            const stripped = line.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
            try {
              const obj = JSON.parse(stripped) as Record<string, unknown>
              if (obj?.type === 'variant' && obj.variant) {
                const v = obj.variant as MinimalVariant
                fullVariants.push(v as Record<string, unknown>)
                // Prefer a short scenario snippet, then objectives, then title for the streaming summary
                const summaryText = (v.scenario && String(v.scenario).trim())
                  ? String(v.scenario).trim().slice(0, 300)
                  : ((Array.isArray(v.objectives) && v.objectives.length) ? (v.objectives || []).slice(0,3).join(', ') : (v.title || ''))
                const summary = {
                  type: 'assignment',
                  assignment: {
                    id: v.id,
                    title: v.title,
                    summary: summaryText
                  }
                }
                controller.enqueue(encoder.encode(JSON.stringify(summary) + '\n'))
              } else if (obj?.type === 'assignment' && obj.assignment) {
                const a = obj.assignment as Record<string, unknown>
                fullVariants.push(a)
                // Build a normalized summary wrapper so the frontend can rely on a.summary
                const summaryText = a.scenario && typeof a.scenario === 'string' && a.scenario.trim()
                  ? String(a.scenario).trim().slice(0, 300)
                  : (Array.isArray(a.objectives) && a.objectives.length ? (a.objectives as string[]).slice(0,3).join(', ') : (a.title || ''))
                const wrapper = { type: 'assignment', assignment: { id: a.id, title: a.title, summary: summaryText } }
                controller.enqueue(encoder.encode(JSON.stringify(wrapper) + '\n'))
              } else {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
              }
            } catch {
                  // If we can't parse the line, emit it as progress so the frontend sees something useful
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', value: stripped }) + '\n'))
            }
          }

          // Prevent unbounded buffer growth in pathological cases
          const MAX_BUFFER = 64 * 1024 // 64KB
          if (buffer.length > MAX_BUFFER) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', value: buffer.slice(0, 1024) }) + '\n'))
            buffer = ''
          }
        }

        try {
          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: IT_TUTOR_SYSTEM_PROMPT },
            { role: 'user', content: finalPrompt }
          ]

            const resolvedModel = resolveModel()
          console.log('Assignment generate - resolved model:', resolvedModel, { isGpt5: isGpt5(resolvedModel) })

          if (isGpt5(resolvedModel)) {
            const client = openaiClient
            const combined = `${IT_TUTOR_SYSTEM_PROMPT}\n\n${finalPrompt}`
            // Constrain model output to speed up generation and make streaming predictable.
            // Note: the Responses API client for GPT-5 models may not accept 'temperature' as a top-level param
            // so we don't pass it here to avoid invalid_request_error.
            const streamOptions: { model: string; input: string; max_output_tokens: number } = {
              model: resolvedModel,
              input: combined,
              // Increase maximum tokens produced by the model so assignments can include fuller details
              max_output_tokens: 8000
            }
            console.log('Starting Responses API stream for assignments', { requestId, model: resolvedModel, max_output_tokens: streamOptions.max_output_tokens })
            const streamStart = Date.now()
            const response = await client.responses.stream(streamOptions)

            for await (const chunkRaw of response) {
              const chunk = chunkRaw as unknown
              let piece: string | null = null
              try {
                const asObj = chunk as Record<string, unknown>
                const delta = asObj['delta']
                const text = asObj['text']
                if (asObj?.['type'] === 'response.output_text.delta' && typeof delta === 'string') piece = delta
                else if (typeof delta === 'string') piece = delta
                else if (typeof text === 'string') piece = text
              } catch {
                // ignore
              }
              if (!piece && typeof chunk === 'string') piece = chunk
              if (piece) {
                buffer += piece
                flushBufferAsJsonLines()
              }
            }

            if (buffer.trim().length > 0) {
              flushBufferAsJsonLines()
              if (buffer.trim().length > 0) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', value: buffer.trim() }) + '\n'))
                buffer = ''
              }
            }
            const streamDuration = Date.now() - streamStart
            console.log('Responses API stream completed', { requestId, streamDurationMs: streamDuration })
          } else {
            // Non-GPT5 streaming via wrapper
            const completion = await createStreamingChatCompletion(messages, { model: 'default', maxTokens: 1500, temperature: 0.4 })
            if (Symbol.asyncIterator in Object(completion)) {
              for await (const chunk of completion as AsyncIterable<unknown>) {
                try {
                  const asObj = chunk as unknown as Record<string, unknown>
                  const choices = asObj['choices'] as unknown
                  if (Array.isArray(choices) && choices.length > 0) {
                    const first = choices[0] as Record<string, unknown>
                    const delta = first['delta'] as unknown
                    const content = delta && typeof delta === 'object' ? (delta as Record<string, unknown>)['content'] : undefined
                    if (typeof content === 'string') { buffer += content; flushBufferAsJsonLines() }
                  }
                } catch {
                  console.error('Error handling completion chunk')
                }
              }
            } else {
              const single = completion as unknown as Record<string, unknown>
              const raw = (single.choices as unknown as Array<Record<string, unknown>> | undefined)?.[0]?.message as unknown as Record<string, unknown> | undefined
              const content = raw?.content
              if (content && typeof content === 'string') { buffer += content; flushBufferAsJsonLines() }
            }
          }
          } catch (err: unknown) {
          console.error('OpenAI streaming request failed for assignments:', err)
          try {
            const fallback = await generateResponse(finalPrompt, IT_TUTOR_SYSTEM_PROMPT, { model: 'quality', maxTokens: 8000, temperature: 0.4 })
            buffer += fallback
            flushBufferAsJsonLines()
          } catch {
            console.error('Assignment fallback failed')
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: 'OpenAI request failed' }) + '\n'))
          }
        } finally {
          try {
            // Emit final full_set with all buffered variants
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'full_set', set: fullVariants }) + '\n'))
          } catch (e) {
            console.error('Failed to enqueue full_set:', e)
          }
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      console.log('Request validation failed:', { requestId, error })
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    console.error('Assignment generation error:', { requestId, error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}