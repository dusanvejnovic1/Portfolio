import { NextResponse } from 'next/server'
import { CurriculumGenerateRequestSchema, createErrorResponse } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPrompt } from '@/lib/prompts/curriculum'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'
import { createStreamingChatCompletion } from '@/lib/llm'
import { createStreamProcessor } from '@/lib/streaming/processor'
import type { CurriculumStreamEvent } from '@/types/modes'
import crypto from 'crypto'

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  
  try {
    // Parse and validate request
    const body = await req.json().catch(() => {
      throw new Error('Invalid JSON payload')
    })

    const parsed = CurriculumGenerateRequestSchema.safeParse(body)
    if (!parsed.success) {
      const error = createErrorResponse(
        'Invalid request parameters',
        parsed.error.format(),
        'VALIDATION_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const requestData = parsed.data

    // Ensure OpenAI key exists
    if (!process.env.OPENAI_API_KEY) {
      const error = createErrorResponse(
        'OpenAI API key not configured',
        undefined,
        'CONFIG_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build prompts
    const system = curriculumSystemPrompt()
    const user = curriculumUserPrompt(
      requestData.topic, 
      requestData.level, 
      requestData.durationDays, 
      requestData.goals
    )

    // Create streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        
        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data)
            } catch {
              // Controller might be closed, ignore the error
              isClosed = true
            }
          }
        }

        try {
          // Initialize stream processor
          const processor = createStreamProcessor({
            onEvent: (event: CurriculumStreamEvent) => {
              const data = JSON.stringify(event) + '\n'
              safeEnqueue(encoder.encode(data))
            },
            onError: (error: Error) => {
              const errorEvent = {
                type: 'error' as const,
                error: error.message
              }
              const data = JSON.stringify(errorEvent) + '\n'
              safeEnqueue(encoder.encode(data))
            },
            maxBufferSize: 128 * 1024 // 128KB buffer limit
          })

          // Start generation
          const resolvedModel = resolveModel()
          
          if (isGpt5(resolvedModel)) {
            await streamWithResponsesAPI(system, user, resolvedModel, processor)
          } else {
            await streamWithChatCompletions(system, user, processor)
          }

          // Flush any remaining content and close
          processor.flush()
          
        } catch (error) {
          const errorEvent = {
            type: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          }
          safeEnqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'))
        } finally {
          isClosed = true
          try {
            controller.close()
          } catch {
            // Controller might already be closed, ignore the error
          }
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const error = createErrorResponse(
      'Internal server error',
      message,
      'INTERNAL_ERROR',
      requestId
    )
    return new NextResponse(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function streamWithResponsesAPI(
  system: string,
  user: string,
  model: string,
  processor: { processChunk: (chunk: string) => void }
) {
  try {
    const client = openaiClient
    const combinedInput = `${system}\n\n${user}`
    const response = await client.responses.stream({ model, input: combinedInput })

    for await (const chunk of response) {
      try {
        const obj = chunk as Record<string, unknown>
        let content: string | null = null

        if (obj?.type === 'response.output_text.delta') {
          content = obj.delta as string
        } else if (obj?.delta) {
          content = obj.delta as string
        } else if (obj?.text) {
          content = obj.text as string
        }

        if (content && typeof content === 'string') {
          processor.processChunk(content)
        }
      } catch (parseError) {
        // Log but don't fail the entire stream for individual chunk errors
        console.warn('Failed to parse GPT-5 response chunk:', parseError)
      }
    }
  } catch (streamErr) {
    throw new Error(`GPT-5 Responses API streaming failed: ${streamErr}`)
  }
}

async function streamWithChatCompletions(
  system: string,
  user: string,
  processor: { processChunk: (chunk: string) => void }
) {
  try {
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user }
    ]

    const completion = await createStreamingChatCompletion(messages, {
      model: 'default',
      maxTokens: 2000,
      temperature: 0.3
    })

    if (Symbol.asyncIterator in Object(completion)) {
      for await (const chunk of completion as AsyncIterable<unknown>) {
        try {
          const obj = chunk as Record<string, unknown>
          const choices = obj.choices as unknown
          
          if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0] as Record<string, unknown>
            const delta = first.delta as unknown
            
            if (delta && typeof delta === 'object') {
              const content = (delta as Record<string, unknown>).content
              if (typeof content === 'string') {
                processor.processChunk(content)
              }
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse chat completion chunk:', parseError)
        }
      }
    } else {
      // Handle non-streaming response
      const single = completion as Record<string, unknown>
      const choices = single.choices as unknown as Array<Record<string, unknown>> | undefined
      const message = choices?.[0]?.message as unknown as Record<string, unknown> | undefined
      const content = message?.content
      
      if (content && typeof content === 'string') {
        processor.processChunk(content)
      }
    }
  } catch (error) {
    throw new Error(`Chat completions streaming failed: ${error}`)
  }
}