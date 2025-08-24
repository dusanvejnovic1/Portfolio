import { NextResponse } from 'next/server'
import { CurriculumGenerateRequestSchema, createErrorResponse } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPrompt, curriculumUserPromptForDays } from '@/lib/prompts/curriculum'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'
import { createStreamingChatCompletion } from '@/lib/llm'
import { createStreamProcessor } from '@/lib/streaming/processor'
import { partitionDays, runWithConcurrency, AbortControllerRegistry } from '@/lib/utils/batch'
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

    // Configuration for parallel generation
    const batchSize = 2  // Generate 2 days per shard
    const concurrency = 3  // Run up to 3 shards concurrently
    
    // Build system prompt
    const system = curriculumSystemPrompt()

    // Create streaming response with parallel orchestrator
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        let stopAll = false
        
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

        // Shared state for deduplication and early stopping
        const daysSeen = new Set<number>()
        const controllerRegistry = new AbortControllerRegistry()
        let collected = 0

        const abortAllShards = () => {
          stopAll = true
          controllerRegistry.abortAll()
        }

        try {
          // Partition days into shards for parallel processing
          const shardBatches = partitionDays(requestData.durationDays, batchSize)
          
          // Send initial progress
          const progressEvent = {
            type: 'progress' as const,
            value: `Starting parallel generation of ${requestData.durationDays} days across ${shardBatches.length} shards...`
          }
          safeEnqueue(encoder.encode(JSON.stringify(progressEvent) + '\n'))

          // Create shard runners
          const shardTasks = shardBatches.map((shardDays, shardIndex) => async () => {
            if (stopAll) return
            
            const shardController = controllerRegistry.create()
            
            try {
              // Create user prompt for this specific shard
              const user = curriculumUserPromptForDays(
                requestData.topic,
                requestData.level,
                shardDays,
                requestData.durationDays,
                requestData.goals
              )

              // Initialize processor for this shard
              const processor = createStreamProcessor({
                onEvent: (event: CurriculumStreamEvent) => {
                  if (stopAll) return
                  
                  if (event.type === 'day') {
                    const dayNum = event.day.day
                    
                    // Validate day number is within expected range
                    if (dayNum < 1 || dayNum > requestData.durationDays) {
                      return // Drop invalid day numbers
                    }
                    
                    collected++
                    
                    // Check if we've collected enough days
                    if (collected >= requestData.durationDays) {
                      // Send final done event
                      const doneEvent = {
                        type: 'done' as const,
                        totalGenerated: collected
                      }
                      safeEnqueue(encoder.encode(JSON.stringify(doneEvent) + '\n'))
                      abortAllShards()
                      return
                    }
                  }
                  
                  // Forward event to client
                  const data = JSON.stringify(event) + '\n'
                  safeEnqueue(encoder.encode(data))
                },
                onError: (error: Error) => {
                  if (stopAll) return
                  
                  const errorEvent = {
                    type: 'error' as const,
                    error: `Shard ${shardIndex + 1} error: ${error.message}`
                  }
                  const data = JSON.stringify(errorEvent) + '\n'
                  safeEnqueue(encoder.encode(data))
                },
                maxBufferSize: 128 * 1024,
                daysSeenGlobal: daysSeen  // Shared deduplication
              })

              // Generate this shard
              const resolvedModel = resolveModel()
              
              if (isGpt5(resolvedModel)) {
                await streamWithResponsesAPI(system, user, resolvedModel, processor, shardController.signal)
              } else {
                await streamWithChatCompletions(system, user, processor, shardController.signal)
              }

              // Don't flush individual shards - let the orchestrator handle completion
              
            } catch (error) {
              if (!stopAll && !shardController.signal.aborted) {
                const errorEvent = {
                  type: 'error' as const,
                  error: `Shard ${shardIndex + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
                safeEnqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'))
              }
            } finally {
              controllerRegistry.remove(shardController)
            }
          })

          // Run shards with concurrency control
          await runWithConcurrency(shardTasks, concurrency)

          // Send final done event if not already sent
          if (!stopAll) {
            const doneEvent = {
              type: 'done' as const,
              totalGenerated: collected
            }
            safeEnqueue(encoder.encode(JSON.stringify(doneEvent) + '\n'))
          }
          
        } catch (error) {
          const errorEvent = {
            type: 'error' as const,
            error: error instanceof Error ? error.message : 'Parallel generation failed'
          }
          safeEnqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'))
        } finally {
          abortAllShards()
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
  processor: { processChunk: (chunk: string) => void },
  signal?: AbortSignal
) {
  try {
    const client = openaiClient
    const combinedInput = `${system}\n\n${user}`
    const response = await client.responses.stream({ model, input: combinedInput })

    for await (const chunk of response) {
      // Check for abort signal
      if (signal?.aborted) {
        break
      }
      
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
  processor: { processChunk: (chunk: string) => void },
  signal?: AbortSignal
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
        // Check for abort signal
        if (signal?.aborted) {
          break
        }
        
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