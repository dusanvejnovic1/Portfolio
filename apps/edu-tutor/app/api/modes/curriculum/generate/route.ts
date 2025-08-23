import { NextResponse } from 'next/server'
import { CurriculumGenerateRequestSchema } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPrompt } from '@/lib/prompts/curriculum'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'
import { createStreamingChatCompletion, createChatCompletion } from '@/lib/llm'

export async function POST(req: Request) {
  try {
    // Parse JSON body
    let body: unknown
    try {
      body = await req.json()
    } catch (err) {
      console.error('Invalid JSON in request body:', err)
      return new NextResponse(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate request
    const parsed = CurriculumGenerateRequestSchema.safeParse(body)
    if (!parsed.success) {
      console.error('Request validation failed:', parsed.error.format())
      return new NextResponse(JSON.stringify({
        error: 'Invalid request parameters',
        details: parsed.error.format()
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const requestData = parsed.data

    // Ensure OpenAI key exists (tests expect this specific error)
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured')
      return new NextResponse(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build prompts
    const system = curriculumSystemPrompt()
    const user = curriculumUserPrompt(requestData.topic, requestData.level, requestData.durationDays, requestData.goals)

    // Stream the model output to the client as NDJSON/SSE-compatible chunks.
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Accumulate partial pieces from the model so we only emit complete
        // JSON objects or newline-delimited lines to the client. This avoids
        // NDJSON parse errors when the SDK sends partial deltas.
        let buffer = ''
        const emittedDays = new Set<number>()
  // Keep full day objects server-side while streaming lighter summaries
  const fullDays: unknown[] = []

        function truncateToSentences(text: string | undefined, maxSentences = 2) {
          if (!text) return ''
          // Simple sentence splitter: look for .!? followed by space or line end
          const parts = text.replace(/\r/g, '').split(/(?<=[.!?])\s+/)
          if (parts.length <= maxSentences) return parts.join(' ').trim()
          return parts.slice(0, maxSentences).join(' ').trim()
        }

        const flushBuffer = () => {
          // Fast NDJSON-oriented parser: process complete newline-terminated lines in a single pass.
          if (!buffer.includes('\n')) return

          const parts = buffer.split('\n')
          buffer = parts.pop() || ''

          for (const rawLine of parts) {
            const line = rawLine.trim()
            if (!line) continue

            const stripped = line.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
            try {
              const obj = JSON.parse(stripped) as unknown
              const maybeDay = (obj as unknown as Record<string, unknown>)?.day
              if (maybeDay && typeof maybeDay === 'object' && typeof (maybeDay as Record<string, unknown>).day === 'number') {
                const dayNum = (maybeDay as Record<string, unknown>).day as number
                if (!emittedDays.has(dayNum)) {
                  emittedDays.add(dayNum)
                  fullDays.push(maybeDay as unknown as Record<string, unknown>)
                  const maybeSummary = (maybeDay as Record<string, unknown>).summary
                  const maybeTitle = (maybeDay as Record<string, unknown>).title
                  const summary = truncateToSentences(typeof maybeSummary === 'string' ? maybeSummary : (typeof maybeTitle === 'string' ? String(maybeTitle) : ''), 2)
                  const summaryObj = { type: 'day', day: { day: dayNum, title: typeof maybeTitle === 'string' ? String(maybeTitle) : undefined, summary } }
                  controller.enqueue(new TextEncoder().encode(JSON.stringify(summaryObj) + '\n'))
                }
                continue
              }
              if (typeof maybeDay === 'number') {
                if (!emittedDays.has(maybeDay)) emittedDays.add(maybeDay)
                else continue
              }
              controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
            } catch {
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', value: stripped }) + '\n'))
            }
          }

          // Prevent unbounded buffer growth
          const MAX_BUFFER = 128 * 1024 // 128KB
          if (buffer.length > MAX_BUFFER) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', value: buffer.slice(0, 1024) }) + '\n'))
            buffer = ''
          }
        }

        try {
          // Prefer the LLM wrapper which selects the right API (Responses vs Chat Completions)
          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]

          // Determine the resolved model and stream appropriately. GPT-5 (Responses API)
          // supports a different streaming endpoint and the llm wrapper does not
          // provide streaming for it — so we must call responses.stream() directly.
          const resolvedModel = resolveModel()
          // Diagnostic log: show which model was resolved for this request
          console.log('Curriculum generate - resolved model:', resolvedModel, { isGpt5: isGpt5(resolvedModel) })
      if (isGpt5(resolvedModel)) {
            try {
        const client = openaiClient
              const combinedInput = `${system}\n\n${user}`
              const response = await client.responses.stream({ model: resolvedModel, input: combinedInput })

              for await (const chunkRaw of response) {
                const chunk = chunkRaw as unknown
                // Append partial text and attempt to flush complete JSON/lines
                let piece: string | null = null
                try {
                  const obj = chunk as Record<string, unknown>
                  // Helper: safely extract string fields without using `any`
                  const tryString = (o: Record<string, unknown> | undefined, key: string) => {
                    const v = o?.[key]
                    return typeof v === 'string' ? v : undefined
                  }

                  if (obj?.type === 'response.output_text.delta') {
                    piece = tryString(obj, 'delta') ?? null
                  } else {
                    piece = tryString(obj, 'delta') ?? tryString(obj, 'text') ?? (typeof chunk === 'string' ? chunk : null)
                  }
                } catch {
                  // ignore parse errors
                }
                if (piece) {
                  buffer += piece
                  flushBuffer()
                }
              }

              // Flush any remainder buffer as a final chunk
              if (buffer.trim().length > 0) {
                // Try one last time to parse remaining content
                flushBuffer()
                if (buffer.trim().length > 0) {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', value: buffer.trim() }) + '\n'))
                  buffer = ''
                }
              }
            } catch (streamErr) {
              console.error('Responses API streaming failed, will try non-streaming fallback:', streamErr)
              throw streamErr
            }
          } else {
            // Attempt streaming via the wrapper for non-GPT5 models
            const completion = await createStreamingChatCompletion(messages, {
              model: 'default',
              maxTokens: 1500,
              temperature: 0.3
            })

            if (Symbol.asyncIterator in Object(completion)) {
              for await (const chunk of completion as AsyncIterable<unknown>) {
                try {
                  const obj = chunk as Record<string, unknown>
                  const choices = obj['choices'] as unknown
                  let piece: string | undefined
                  if (Array.isArray(choices) && choices.length > 0) {
                    const first = choices[0] as Record<string, unknown>
                    const delta = first['delta'] as unknown
                    if (delta && typeof delta === 'object') {
                      const content = (delta as Record<string, unknown>)['content']
                      if (typeof content === 'string') piece = content
                    }
                    if (!piece) {
                      const message = first['message'] as unknown
                      if (message && typeof message === 'object') {
                        const content = (message as Record<string, unknown>)['content']
                        if (typeof content === 'string') piece = content
                      }
                    }
                  }
                  if (piece) {
                    buffer += piece
                    flushBuffer()
                  }
                } catch {
                  console.error('Error handling completion chunk')
                }
              }
            } else {
              try {
                const single = completion as unknown as Record<string, unknown>
                const choices = single.choices as unknown as Array<Record<string, unknown>> | undefined
                const message = choices?.[0]?.message as unknown as Record<string, unknown> | undefined
                const raw = message?.content
                if (raw && typeof raw === 'string') {
                  buffer += raw
                  flushBuffer()
                }
              } catch {
                console.error('Error handling non-streaming completion result')
              }
            }
          }
          } catch {
            console.error('OpenAI streaming request failed (will try non-streaming):')

            // Non-streaming fallback using the wrapper (handles GPT-5 Responses API vs Chat Completions).
            try {
              const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: system },
                { role: 'user', content: user }
              ]

              const fallback = await createChatCompletion(messages, {
                model: 'default',
                maxTokens: 1500,
                temperature: 0.3,
                stream: false
              })

              // Normalize fallback which may be a stream or single completion
              if (Symbol.asyncIterator in Object(fallback)) {
                for await (const chunk of fallback as AsyncIterable<unknown>) {
                  try {
                    const obj = chunk as Record<string, unknown>
                    const choices = obj['choices'] as unknown
                    if (Array.isArray(choices) && choices.length > 0) {
                      const first = choices[0] as Record<string, unknown>
                      const delta = first['delta'] as unknown
                      let piece: string | undefined
                      if (delta && typeof delta === 'object') {
                        const content = (delta as Record<string, unknown>)['content']
                        if (typeof content === 'string') piece = content
                      }
                      if (!piece) {
                        const message = first['message'] as unknown
                        if (message && typeof message === 'object') {
                          const content = (message as Record<string, unknown>)['content']
                          if (typeof content === 'string') piece = content
                        }
                      }
                      if (piece) { buffer += piece; flushBuffer() }
                    }
                  } catch {
                    console.error('Error handling fallback chunk')
                  }
                }
              } else {
                const raw = ((fallback as unknown as Record<string, unknown>)?.choices as unknown as Array<Record<string, unknown>> | undefined)?.[0]?.message as unknown as Record<string, unknown> | undefined
                const content = raw?.content
                if (content && typeof content === 'string') {
                  buffer += content
                  flushBuffer()
                } else {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: 'Empty response from model' }) + '\n'))
                }
              }
            } catch (fallbackErr) {
              console.error('Fallback non-streaming OpenAI request failed:', fallbackErr)
              const message = fallbackErr instanceof Error ? fallbackErr.message : 'OpenAI request failed'
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: message }) + '\n'))
            }
        } finally {
          // After all streaming/fallback work, ensure we flush any remaining buffer
          try {
            if (buffer.trim().length > 0) {
              flushBuffer()
              if (buffer.trim().length > 0) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', value: buffer.trim() }) + '\n'))
                buffer = ''
              }
            }
            // Emit a final done event with the total generated count if known
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', totalGenerated: Array.from(emittedDays).length }) + '\n'))
            // Emit a single full_plan event containing all buffered full day objects
            try {
              if (fullDays.length > 0) {
                // Send the complete plan once to the client
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'full_plan', plan: { days: fullDays } }) + '\n'))
              }
            } catch (e) {
              console.error('Failed to enqueue full_plan event:', e)
            }
          } catch (e) {
            console.error('Error flushing buffer on close:', e)
          }
          controller.close()
        }
      }
    })

    // Return a streaming response the client can consume with the existing NDJSON/SSE reader.
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    })
  } catch (err) {
    console.error('Unhandled error in curriculum generate route:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new NextResponse(JSON.stringify({ error: 'Internal server error', details: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Clean end of file - touched to trigger rebuild

