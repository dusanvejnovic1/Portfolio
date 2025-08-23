import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // Check for OpenAI API key first
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { messages = [], systemPrompt = '', model: requestedModel } = body || {}
    const model = resolveModel(requestedModel)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chatMessages = [] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
          if (systemPrompt) chatMessages.push({ role: 'system', content: systemPrompt })
          for (const m of messages) {
            if (m.role && m.content) chatMessages.push({ role: m.role, content: m.content })
          }

          const client = openaiClient

                const extractContent = (chunk: unknown) => {
                  try {
                    const obj = chunk as Record<string, unknown>
                    const choices = obj['choices'] as unknown
                    if (Array.isArray(choices) && choices.length > 0) {
                      const first = choices[0] as Record<string, unknown>
                      const delta = first['delta'] as unknown
                      if (delta && typeof delta === 'object') {
                        const content = (delta as Record<string, unknown>)['content']
                        if (typeof content === 'string') return content
                      }
                      const message = first['message'] as unknown
                      if (message && typeof message === 'object') {
                        const content = (message as Record<string, unknown>)['content']
                        if (typeof content === 'string') return content
                      }
                    }
                    return undefined
                  } catch {
                    return undefined
                  }
                }

          if (isGpt5(model)) {
            try {
              // First attempt: Use OpenAI's Responses API (native GPT-5 endpoint)
              const combinedInput = chatMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
              
              const response = await client.responses.stream({
                model,
                input: combinedInput,
                // Note: GPT-5 Responses API doesn't use max_tokens parameter
              })

              // Handle native GPT-5 streaming response
              // Note: The exact streaming format for GPT-5 Responses API may vary
              // This is a simplified handling that should work with most response types
              for await (const chunk of response) {
                // Handle various chunk types that contain text content
                if ('delta' in chunk && typeof chunk.delta === 'string') {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: chunk.delta }) + '\n'))
                } else if ('text' in chunk && typeof chunk.text === 'string') {
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: chunk.text }) + '\n'))
                }
              }
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
              
            } catch (responseApiError) {
              console.log('GPT-5 Responses API failed, attempting Chat Completions API:', responseApiError)
              
              // Check if this is an access issue and should fallback to GPT-4
              const accessError = responseApiError instanceof Error && (
                responseApiError.message.includes('API key') ||
                responseApiError.message.includes('model') ||
                responseApiError.message.includes('authentication') ||
                responseApiError.message.includes('unauthorized')
              )
              
              if (accessError) {
                console.log('GPT-5 access issue detected, falling back to GPT-4o-mini')
                // Fallback to GPT-4o-mini
                const { createStreamingChatCompletion } = await import('@/lib/llm')
                const completion = await createStreamingChatCompletion(chatMessages, { model: 'quality', maxTokens: 1200, temperature: 0.5 })

                if (Symbol.asyncIterator in Object(completion)) {
                  for await (const chunk of completion as AsyncIterable<unknown>) {
                    const content = extractContent(chunk)
                    if (content) controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content }) + '\n'))
                  }
                } else {
                  const single = completion as unknown as Record<string, unknown>
                  const choices = single.choices as unknown as Array<Record<string, unknown>> | undefined
                  const message = choices?.[0]?.message as unknown as Record<string, unknown> | undefined
                  const raw = message?.content
                  if (raw && typeof raw === 'string') controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: raw }) + '\n'))
                }
              } else {
                // Try GPT-5 with Chat Completions API
                const { createStreamingChatCompletion } = await import('@/lib/llm')
                const completion = await createStreamingChatCompletion(chatMessages, { model: 'default', maxTokens: 1200, temperature: 0.5 })

                if (Symbol.asyncIterator in Object(completion)) {
                  for await (const chunk of completion as AsyncIterable<unknown>) {
                    const content = extractContent(chunk)
                    if (content) controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content }) + '\n'))
                  }
                } else {
                  const single = completion as unknown as Record<string, unknown>
                  const choices = single.choices as unknown as Array<Record<string, unknown>> | undefined
                  const message = choices?.[0]?.message as unknown as Record<string, unknown> | undefined
                  const raw = message?.content
                  if (raw && typeof raw === 'string') controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: raw }) + '\n'))
                }
              }
              
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
            }
          } else {
            // Use standard Chat Completions API for GPT-4 family
            const { createStreamingChatCompletion } = await import('@/lib/llm')
            const completion = await createStreamingChatCompletion(chatMessages, { model: 'default', maxTokens: 1200, temperature: 0.5 })

            if (Symbol.asyncIterator in Object(completion)) {
              for await (const chunk of completion as AsyncIterable<unknown>) {
                const content = extractContent(chunk)
                if (content) controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content }) + '\n'))
              }
            } else {
              const single = completion as unknown as Record<string, unknown>
              const choices = single.choices as unknown as Array<Record<string, unknown>> | undefined
              const message = choices?.[0]?.message as unknown as Record<string, unknown> | undefined
              const raw = message?.content
              if (raw && typeof raw === 'string') controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: raw }) + '\n'))
            }
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
          }
          
          console.log('Chat modes request completed successfully', {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            model
          })
          
        } catch (error) {
          console.error('OpenAI API error in modes/chat:', error, {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            model
          })
          
          // Provide specific error messages instead of always showing demo mode
          let errorMessage = "I encountered an error while processing your request. Please try again."
          
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorMessage = 'Service configuration error. Please contact support.'
            } else if (error.message.includes('model') || error.message.includes('Model')) {
              errorMessage = `Model configuration error for '${model}'. Please verify the model is available.`
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
              errorMessage = 'OpenAI rate limit reached. Please try again in a moment.'
            } else if (error.message.includes('Connection error') || 
                       error.message.includes('ENOTFOUND') || 
                       error.message.includes('getaddrinfo')) {
              // Only show demo mode for actual network connectivity issues
              errorMessage = "I'm currently in demo mode. The OpenAI API is not accessible in this environment, but in a real deployment, I would provide helpful tutoring assistance based on your question. Please ensure your OpenAI API key is properly configured for full functionality."
            }
          }
          
          // Stream the error message
          for (let i = 0; i < errorMessage.length; i += 10) {
            const chunk = errorMessage.slice(i, i + 10)
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content: chunk }) + '\n'))
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      }
    })
  } catch (error) {
    console.error('Modes chat API error:', error, {
      request_id: requestId,
      timestamp: new Date().toISOString()
    })
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}