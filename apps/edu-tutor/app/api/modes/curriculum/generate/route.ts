import { NextResponse } from 'next/server'
import { CurriculumGenerateRequestSchema, CurriculumGenerateResponseSchema } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPrompt } from '@/lib/prompts/curriculum'
import { openai, resolveModel, isGpt5 } from '@/lib/openai'
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

        const flushBuffer = () => {
          // Extract complete JSON objects by matching braces, and also
          // handle newline-delimited lines that may be plain text.
          let changed = true
          while (changed) {
            changed = false
            // Try to find a complete JSON object by scanning for matching braces
            const startIdx = buffer.indexOf('{')
            if (startIdx !== -1) {
              let depth = 0
              let endIdx = -1
              for (let i = startIdx; i < buffer.length; i++) {
                const ch = buffer[i]
                if (ch === '{') depth++
                else if (ch === '}') {
                  depth--
                  if (depth === 0) { endIdx = i; break }
                }
              }
              if (endIdx !== -1) {
                const candidate = buffer.slice(startIdx, endIdx + 1)
                try {
                  const obj = JSON.parse(candidate)
                  // Deduplicate day events by day number when possible
                  if (obj && typeof obj === 'object') {
                    const maybeDay = (obj as any).day
                    if (typeof maybeDay === 'number') {
                      if (emittedDays.has(maybeDay)) {
                        // remove the processed region and continue
                        buffer = buffer.slice(endIdx + 1)
                        changed = true
                        continue
                      }
                      emittedDays.add(maybeDay)
                    }
                  }
                  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
                  buffer = buffer.slice(endIdx + 1)
                  changed = true
                  continue
                } catch (e) {
                  // Not parseable; fall through to newline handling
                }
              }
            }

            // Handle newline-delimited lines (plain text or single-line JSON)
            const nl = buffer.indexOf('\n')
            if (nl !== -1) {
              const line = buffer.slice(0, nl).trim()
              buffer = buffer.slice(nl + 1)
              if (line) {
                try {
                  const obj = JSON.parse(line)
                  const maybeDay = (obj as any).day
                  if (typeof maybeDay === 'number') {
                    if (!emittedDays.has(maybeDay)) emittedDays.add(maybeDay)
                    else {
                      changed = true
                      continue
                    }
                  }
                  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
                } catch (e) {
                  // Treat as progress text
                  controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', value: line }) + '\n'))
                }
                changed = true
                continue
              }
            }
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
          if (isGpt5(resolvedModel)) {
            try {
              const client = openai()
              const combinedInput = `${system}\n\n${user}`
              const response = await client.responses.stream({ model: resolvedModel, input: combinedInput })

              for await (const chunkRaw of response) {
                const chunk: any = chunkRaw
                // Append partial text and attempt to flush complete JSON/lines
                let piece: string | null = null
                if (chunk?.type === 'response.output_text.delta' && typeof chunk.delta === 'string') piece = chunk.delta
                else if (typeof chunk?.delta === 'string') piece = chunk.delta
                else if (typeof chunk?.text === 'string') piece = chunk.text
                else if (typeof chunk === 'string') piece = chunk
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
              for await (const chunk of completion as AsyncIterable<any>) {
                try {
                  const piece = chunk.choices?.[0]?.delta?.content
                  if (piece) {
                    buffer += piece
                    flushBuffer()
                  }
                } catch (inner) {
                  console.error('Error handling completion chunk:', inner)
                }
              }
            } else {
              try {
                const single = completion as any
                const raw = single?.choices?.[0]?.message?.content
                if (raw && typeof raw === 'string') {
                  buffer += raw
                  flushBuffer()
                }
              } catch (inner) {
                console.error('Error handling non-streaming completion result:', inner)
              }
            }
          }
          } catch (err) {
            console.error('OpenAI streaming request failed (will try non-streaming):', err)

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
                for await (const chunk of fallback as AsyncIterable<any>) {
                  const piece = chunk.choices?.[0]?.delta?.content
                  if (piece) {
                    buffer += piece
                    flushBuffer()
                  }
                }
              } else {
                const raw = (fallback as any)?.choices?.[0]?.message?.content
                if (raw && typeof raw === 'string') {
                  buffer += raw
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

