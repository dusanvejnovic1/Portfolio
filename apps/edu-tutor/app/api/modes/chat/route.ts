import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { openai, resolveModel } from '@/lib/openai'

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

          const completion = await openai().chat.completions.create({
            model,
            messages: chatMessages,
            temperature: 0.5,
            max_tokens: 1200,
            stream: true,
          })

          for await (const chunk of completion) {
            const content = chunk.choices?.[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', content }) + '\n'))
            }
          }
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
          
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