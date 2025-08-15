import { NextRequest } from 'next/server'
import { openai, moderateContent, DEFAULT_MODEL, QUALITY_MODEL } from '@/lib/openai'
import { checkRateLimit } from '@/lib/rateLimit'
import { SYSTEM_PROMPT, MODERATION_REFUSAL_MESSAGE, RATE_LIMIT_MESSAGE } from '@/lib/prompts'

// Use Node.js runtime for in-memory rate limiting
export const runtime = 'nodejs'

function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIP = request.headers.get('x-real-ip')
  const socketRemoteAddress = request.headers.get('x-forwarded-for')
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }
  if (xRealIP) {
    return xRealIP
  }
  return socketRemoteAddress || 'unknown'
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  try {
    // Rate limiting check
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(clientIP)
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`, {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
      })
      
      return Response.json(
        { error: RATE_LIMIT_MESSAGE },
        { 
          status: 429,
          headers: { 'X-RateLimit-Remaining': '0' }
        }
      )
    }
    
    const body = await request.json()
    const { message, mode = 'hints' } = body
    
    // Input validation
    if (!message || typeof message !== 'string') {
      return Response.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }
    
    if (message.length > 1500) {
      return Response.json(
        { error: 'Message too long. Please limit to 1500 characters.' },
        { status: 400 }
      )
    }
    
    if (mode && !['hints', 'solution'].includes(mode)) {
      return Response.json(
        { error: 'Mode must be either "hints" or "solution"' },
        { status: 400 }
      )
    }
    
    // Content moderation
    const moderationResult = await moderateContent(message)
    
    if (moderationResult.flagged) {
      console.log(`Content flagged for IP: ${clientIP}`, {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
        categories: moderationResult.categories,
      })
      
      return Response.json({ error: MODERATION_REFUSAL_MESSAGE }, { status: 400 })
    }
    
    // Prepare system prompt based on mode
    let systemPrompt = SYSTEM_PROMPT
    if (mode === 'hints') {
      systemPrompt += `\n\nIMPORTANT: You are currently in "hints" mode. Provide 1-2 helpful hints but DO NOT give the complete solution or final answer. Guide the student's thinking process.`
    } else if (mode === 'solution') {
      systemPrompt += `\n\nIMPORTANT: You are currently in "solution" mode. Provide a complete explanation with step-by-step reasoning and include the final answer.`
    }
    
    // Choose model (could be extended with quality flag later)
    const model = DEFAULT_MODEL
    
    // Create SSE stream
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const completion = await openai().chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.5,
            max_tokens: 800, // Keep responses concise
            stream: true,
          })
          
          // Send periodic keepalive comments
          const keepAliveInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'))
            } catch (e) {
              clearInterval(keepAliveInterval)
            }
          }, 30000) // Every 30 seconds
          
          let fullResponse = ''
          
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              fullResponse += content
              const data = JSON.stringify({ delta: content })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          
          clearInterval(keepAliveInterval)
          
          // Send final completion message
          const doneData = JSON.stringify({ done: true })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
          
          // Log request completion (no content)
          const latency = Date.now() - startTime
          console.log('Request completed', {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
            model,
            mode,
            latency,
            response_length: fullResponse.length,
          })
          
        } catch (error) {
          console.error('Streaming error:', error, {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
          })
          
          const errorData = JSON.stringify({ 
            error: 'Sorry, I encountered an error while processing your request. Please try again.' 
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      }
    })
    
  } catch (error) {
    console.error('Chat API error:', error, {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    })
    
    return Response.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}