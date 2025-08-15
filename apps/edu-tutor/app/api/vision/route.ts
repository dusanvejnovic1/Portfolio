import { NextRequest } from 'next/server'
import { openai, moderateContent } from '@/lib/openai'
import { checkRateLimit } from '@/lib/rateLimit'
import { VISION_SYSTEM_PROMPT, MODERATION_REFUSAL_MESSAGE, RATE_LIMIT_MESSAGE } from '@/lib/prompts'

// Use Node.js runtime for file processing
export const runtime = 'nodejs'

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('x-vercel-forwarded-for')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (remoteAddr) {
    return remoteAddr.split(',')[0].trim()
  }
  return 'unknown'
}

export async function OPTIONS() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
    },
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  const clientIP = getClientIP(request)

  // CORS headers
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`, {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        ip: clientIP,
      })
      
      return Response.json(
        { error: RATE_LIMIT_MESSAGE },
        { status: 429, headers: corsHeaders }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const prompt = formData.get('prompt') as string || ''
    const mode = formData.get('mode') as string || 'hints'
    const imageFile = formData.get('image') as File

    // Validate image file is present
    if (!imageFile) {
      return Response.json(
        { error: 'Image file is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(imageFile.type)) {
      return Response.json(
        { error: 'Only JPEG and PNG images are supported' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate file size (500MB = 524,288,000 bytes)
    const maxSize = 500 * 1024 * 1024 // 500MB in bytes
    if (imageFile.size > maxSize) {
      return Response.json(
        { error: `Image file too large. Maximum size is 500MB, got ${Math.round(imageFile.size / (1024 * 1024))}MB` },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate mode
    if (mode && !['hints', 'solution'].includes(mode)) {
      return Response.json(
        { error: 'Mode must be either "hints" or "solution"' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate prompt length if provided
    if (prompt && prompt.length > 1500) {
      return Response.json(
        { error: 'Prompt too long. Please limit to 1500 characters.' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Content moderation on prompt if provided
    if (prompt.trim()) {
      const moderationResult = await moderateContent(prompt)
      
      if (moderationResult.flagged) {
        console.log(`Content flagged for IP: ${clientIP}`, {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          ip: clientIP,
          categories: moderationResult.categories,
        })
        
        return Response.json(
          { error: MODERATION_REFUSAL_MESSAGE },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const imageDataUrl = `data:${imageFile.type};base64,${base64Image}`

    // Prepare system prompt based on mode
    let systemPrompt = VISION_SYSTEM_PROMPT
    if (mode === 'hints') {
      systemPrompt += "\n\nProvide 1-2 helpful hints to guide the user's understanding, but don't give away the complete solution yet."
    } else if (mode === 'solution') {
      systemPrompt += "\n\nProvide a complete step-by-step explanation and solution."
    }

    // Log request (no content)
    console.log('Vision request started', {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      ip: clientIP,
      mode,
      image_type: imageFile.type,
      image_size: imageFile.size,
      has_prompt: !!prompt.trim(),
    })

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messages: Array<
            | { role: 'system'; content: string }
            | { role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } }> }
          > = [
            { role: 'system' as const, content: systemPrompt }
          ]

          // Add user message with image and optional prompt
          const userContent: Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } }
          > = [
            {
              type: 'image_url' as const,
              image_url: {
                url: imageDataUrl,
                detail: 'high' as const // Use high detail for better analysis
              }
            }
          ]

          if (prompt.trim()) {
            userContent.unshift({
              type: 'text' as const,
              text: prompt
            })
          } else {
            userContent.unshift({
              type: 'text' as const,
              text: mode === 'hints' 
                ? 'Please analyze this image and provide helpful hints about what you see.'
                : 'Please analyze this image and provide a detailed explanation of what you see.'
            })
          }

          messages.push({
            role: 'user' as const,
            content: userContent
          })

          const completion = await openai().chat.completions.create({
            model: 'gpt-4o', // Use GPT-4 Vision for image analysis
            messages,
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
          console.log('Vision request completed', {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
            model: 'gpt-4o',
            mode,
            latency,
            response_length: fullResponse.length,
          })
          
        } catch (error) {
          console.error('Vision streaming error:', error, {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            ip: clientIP,
          })
          
          const errorData = JSON.stringify({ 
            error: 'Sorry, I encountered an error while analyzing your image. Please try again.' 
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
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Vision API error:', error, {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      ip: clientIP,
    })

    return Response.json(
      { error: 'Failed to process vision request' },
      { status: 500, headers: corsHeaders }
    )
  }
}