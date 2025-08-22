import { NextRequest } from 'next/server'
import { openai, resolveModel } from '@/lib/openai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
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
        } catch {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: 'Chat failed' }) + '\n'))
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
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}