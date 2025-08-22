import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { openai, moderateContent, validateEnvironment, resolveModel, isGpt5 } from '@/lib/openai'
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
    // Validate environment at request time
    const envValidation = validateEnvironment()
    if (!envValidation.ok) {
      console.log('Chat request failed - environment validation', {
        event: 'chat_env_error',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        error: envValidation.error
      })
      
      return Response.json({
        error: 'Service configuration error. Please contact support.',
        code: 'config_error'
      }, { status: 500 })
    }
    
    // Rate limiting check
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(clientIP)
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`, {
        event: 'rate_limit_exceeded',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
      })
      
      return Response.json(
        { 
          error: RATE_LIMIT_MESSAGE,
          code: 'rate_limited'
        },
        { 
          status: 429,
          headers: { 'X-RateLimit-Remaining': '0' }
        }
      )
    }
    
    const body = await request.json()
    const { message, mode = 'hints', model: requestedModel } = body
    
    // Input validation
    if (!message || typeof message !== 'string') {
      return Response.json(
        { 
          error: 'Message is required and must be a string',
          code: 'invalid_input'
        },
        { status: 400 }
      )
    }
    
    if (message.length > 1500) {
      return Response.json(
        { 
          error: 'Message too long. Please limit to 1500 characters.',
          code: 'message_too_long'
        },
        { status: 400 }
      )
    }
    
    if (mode && !['hints', 'solution'].includes(mode)) {
      return Response.json(
        { 
          error: 'Mode must be either "hints" or "solution"',
          code: 'invalid_mode'
        },
        { status: 400 }
      )
    }
    
    // Content moderation
    const moderationResult = await moderateContent(message)
    
    // Check for moderation service errors
    if ('service_error' in moderationResult && moderationResult.service_error) {
      console.log('Content moderation service error, allowing request to proceed', {
        event: 'moderation_service_error',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
      })
      // Continue with request despite moderation service failure
    } else if (moderationResult.flagged) {
      console.log(`Content flagged for IP: ${clientIP}`, {
        event: 'content_moderated',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
        categories: moderationResult.categories,
      })
      
      return Response.json({ 
        error: MODERATION_REFUSAL_MESSAGE,
        code: 'moderated'
      }, { status: 400 })
    }
    
    // Prepare system prompt based on mode
    let systemPrompt = SYSTEM_PROMPT
    if (mode === 'hints') {
      systemPrompt += `\n\nIMPORTANT: You are currently in "hints" mode. Provide 1-2 helpful hints but DO NOT give the complete solution or final answer. Guide the student's thinking process.`
    } else if (mode === 'solution') {
      systemPrompt += `\n\nIMPORTANT: You are currently in "solution" mode. Provide a complete explanation with step-by-step reasoning and include the final answer.`
    }
    
    // Resolve the model to use
    const model = resolveModel(requestedModel)
    const endpoint = isGpt5(model) ? 'responses' : 'chat.completions'
    
    // Log the resolved model and endpoint for debugging
    console.log('Chat request using model:', {
      requested: requestedModel,
      resolved: model,
      endpoint,
      event: 'chat_model_resolved',
      request_id: requestId
    })
    
    // Create SSE stream
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = ''
          let usedFallback = false
          
          if (isGpt5(model)) {
            // Try to use Responses API for GPT-5 first
            console.log(`Attempting to use Responses API for GPT-5 model: ${model}`)
            
            try {
              // Check if responses API exists
              const client = openai()
              if (!client.responses || typeof client.responses.stream !== 'function') {
                throw new Error('Responses API not available in current SDK version')
              }
              
              // Prepare reasoning configuration from request
              const { reasoning } = body
              let reasoningConfig = undefined
              
              if (reasoning?.effort) {
                reasoningConfig = { effort: reasoning.effort }
              }
              
              // For now, use a simple string input combining system and user message
              const combinedInput = `${systemPrompt}\n\nUser: ${message}`
              
              const response = await client.responses.stream({
                model,
                input: combinedInput,
                ...(reasoningConfig && { reasoning: reasoningConfig })
              })
              
              // Send periodic keepalive comments
              const keepAliveInterval = setInterval(() => {
                try {
                  controller.enqueue(encoder.encode(': keepalive\n\n'))
                } catch {
                  clearInterval(keepAliveInterval)
                }
              }, 30000) // Every 30 seconds
              
              for await (const chunk of response) {
                // Handle different chunk types from Responses API
                if (chunk.type === 'response.output_text.delta') {
                  const content = chunk.delta
                  if (content) {
                    fullResponse += content
                    const data = JSON.stringify({ delta: content })
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                  }
                }
              }
              
              clearInterval(keepAliveInterval)
            } catch (responseApiError) {
              console.log(`Responses API failed for ${model}, falling back to Chat Completions API:`, responseApiError)
              usedFallback = true
              
              // Fallback to Chat Completions API for GPT-5 models
              const completion = await openai().chat.completions.create({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: message }
                ],
                temperature: 0.5,
                max_tokens: 800,
                stream: true,
              })
              
              // Send periodic keepalive comments
              const keepAliveInterval = setInterval(() => {
                try {
                  controller.enqueue(encoder.encode(': keepalive\n\n'))
                } catch {
                  clearInterval(keepAliveInterval)
                }
              }, 30000) // Every 30 seconds
              
              for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                  fullResponse += content
                  const data = JSON.stringify({ delta: content })
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }
              }
              
              clearInterval(keepAliveInterval)
            }
          } else {
            // Use Chat Completions API for GPT-4 family
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
              } catch {
                clearInterval(keepAliveInterval)
              }
            }, 30000) // Every 30 seconds
            
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                fullResponse += content
                const data = JSON.stringify({ delta: content })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            }
            
            clearInterval(keepAliveInterval)
          }
          
          // Log successful OpenAI response
          console.log('OpenAI response received successfully', {
            event: 'openai_response_received',
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
            model,
            endpoint,
            mode,
            usedFallback
          })
          
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
            endpoint,
            mode,
            latency,
            response_length: fullResponse.length,
          })
          
        } catch (error) {
          console.error('Streaming error:', error, {
            event: 'openai_provider_error',
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
            model: model,
            endpoint
          })
          
          // Determine error type and provide structured response
          let errorMessage = 'Sorry, I encountered an error while processing your request. Please try again.'
          let errorCode = 'provider_error'
          
          if (error instanceof Error) {
            if (error.message.includes('API key')) {
              errorCode = 'config_error'
              errorMessage = 'Service configuration error. Please contact support.'
            } else if (error.message.includes('rate limit') || error.message.includes('429')) {
              errorCode = 'rate_limited'
              errorMessage = 'OpenAI rate limit reached. Please try again in a moment.'
            } else if (error.message.includes('model') || error.message.includes('Model')) {
              errorCode = 'config_error'
              errorMessage = `Model configuration error for '${model}'. Please verify the model is available for your API key or check for typos.`
            }
          }
          
          const errorData = JSON.stringify({ 
            error: errorMessage,
            code: errorCode,
            model: model
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
      event: 'chat_api_error',
      request_id: requestId,
      timestamp: new Date().toISOString(),
    })
    
    return Response.json(
      { 
        error: 'Internal server error. Please try again later.',
        code: 'server_error'
      },
      { status: 500 }
    )
  }
}