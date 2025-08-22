import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { openai } from '@/lib/openai'
import { getModelForTask } from '@/lib/llm'
import { preModerate } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { CURRICULUM_BATCH_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { searchITResources } from '@/lib/retrieval/webSearch'
import { searchITVideos } from '@/lib/retrieval/youtube'
import { CurriculumDay } from '@/types/modes'

// Request validation schema
const CurriculumGenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationDays: z.number().min(1).max(180),
  batch: z.object({
    startDay: z.number().min(1),
    endDay: z.number().min(1)
  }),
  outline: z.array(z.object({
    week: z.number(),
    focus: z.string(),
    notes: z.string().optional()
  })).optional(),
  useWeb: z.boolean().optional(),
  retrievalContext: z.any().optional()
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Curriculum batch generate request:', { requestId, timestamp: new Date().toISOString() })

  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded:', { requestId, ip: clientIP })
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const parsed = CurriculumGenerateRequestSchema.parse(body)

    // Validate batch range
    if (parsed.batch.startDay > parsed.batch.endDay) {
      return NextResponse.json(
        { error: 'Invalid batch range: startDay must be <= endDay' },
        { status: 400 }
      )
    }

    if (parsed.batch.endDay > parsed.durationDays) {
      return NextResponse.json(
        { error: 'Batch end day exceeds curriculum duration' },
        { status: 400 }
      )
    }

    const batchSize = parsed.batch.endDay - parsed.batch.startDay + 1
    if (batchSize > 7) {
      return NextResponse.json(
        { error: 'Batch size too large. Maximum 7 days per batch.' },
        { status: 400 }
      )
    }

    // Content moderation
    const moderation = await preModerate(parsed.topic, { maxLength: 200 })
    if (!moderation.allowed) {
      console.log('Content blocked by moderation:', { requestId, reason: moderation.reason })
      return NextResponse.json(
        { error: moderation.reason || 'Content not allowed' },
        { status: 400 }
      )
    }

    // Retrieve additional context if requested
    let retrievalContext = ''
    if (parsed.useWeb) {
      console.log('Retrieving web context:', { requestId, topic: parsed.topic })
      
      try {
        const webResults = await searchITResources(parsed.topic, { 
          level: parsed.level,
          count: 5,
          includeRecent: true
        })
        
        const videoResults = await searchITVideos(parsed.topic, {
          level: parsed.level,
          maxResults: 3,
          includeRecent: true
        })

        if (webResults.length > 0 || videoResults.length > 0) {
          retrievalContext = '\n\nAdditional Resources to Reference:\n'
          
          webResults.forEach(result => {
            retrievalContext += `- ${result.name}: ${result.url} (${result.snippet})\n`
          })
          
          videoResults.forEach(video => {
            retrievalContext += `- Video: ${video.snippet.title}: https://youtube.com/watch?v=${video.id.videoId}\n`
          })
        }
      } catch (error) {
        console.warn('Retrieval failed, continuing without context:', { requestId, error })
      }
    }

    // Build outline context
    let outlineContext = ''
    if (parsed.outline && parsed.outline.length > 0) {
      outlineContext = '\n\nCurriculum Outline:\n'
      parsed.outline.forEach(week => {
        outlineContext += `Week ${week.week}: ${week.focus}`
        if (week.notes) {
          outlineContext += ` (${week.notes})`
        }
        outlineContext += '\n'
      })
    }

    // Generate curriculum batch with streaming
    const prompt = `${CURRICULUM_BATCH_PROMPT}

Topic: ${parsed.topic}
Level: ${parsed.level}
Generate Days: ${parsed.batch.startDay} to ${parsed.batch.endDay}${outlineContext}${retrievalContext}

Focus on practical, hands-on learning with real-world applications.`

    console.log('Starting streaming generation:', { 
      requestId, 
      topic: parsed.topic, 
      batchRange: `${parsed.batch.startDay}-${parsed.batch.endDay}`,
      useWeb: parsed.useWeb
    })

    // Create streaming response
    const client = openai() // Get client directly
    const selectedModel = getModelForTask('quality')
    
    const stream = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: IT_TUTOR_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.3,
      stream: true
    })

    // Set up streaming response with proper headers
    const headers = new Headers({
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    // Check CORS
    const origin = request.headers.get('origin')
    const allowedOrigin = process.env.ALLOWED_ORIGIN
    if (allowedOrigin === '*' || origin === allowedOrigin) {
      headers.set('Access-Control-Allow-Origin', origin || '*')
      headers.set('Access-Control-Allow-Methods', 'POST')
      headers.set('Access-Control-Allow-Headers', 'Content-Type')
    }

    // Create readable stream for NDJSON response
    const encoder = new TextEncoder()
    let buffer = ''
    let dayCount = 0

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          const progressMsg = JSON.stringify({ 
            type: 'progress', 
            value: `Starting batch generation for days ${parsed.batch.startDay}-${parsed.batch.endDay}` 
          }) + '\n'
          controller.enqueue(encoder.encode(progressMsg))

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            buffer += delta

            // Try to extract complete JSON objects from buffer
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue

              try {
                const parsed = JSON.parse(trimmed)
                
                if (parsed.type === 'day' && parsed.day) {
                  // Validate day structure
                  const day = parsed.day as CurriculumDay
                  if (day.day && day.title && day.summary) {
                    dayCount++
                    
                    // Send progress update
                    const progressUpdate = JSON.stringify({
                      type: 'progress',
                      value: `Completed Day ${day.day}: ${day.title}`
                    }) + '\n'
                    controller.enqueue(encoder.encode(progressUpdate))
                    
                    // Send the day data
                    const dayMsg = JSON.stringify(parsed) + '\n'
                    controller.enqueue(encoder.encode(dayMsg))
                    
                    console.log('Generated day:', { requestId, dayNumber: day.day, title: day.title })
                  }
                } else if (parsed.type === 'progress') {
                  // Forward progress messages
                  const progressMsg = JSON.stringify(parsed) + '\n'
                  controller.enqueue(encoder.encode(progressMsg))
                }
              } catch {
                // Ignore malformed JSON, continue accumulating
              }
            }
          }

          // Final completion message
          const completionMsg = JSON.stringify({
            type: 'progress',
            value: `Batch generation complete. Generated ${dayCount} days.`
          }) + '\n'
          controller.enqueue(encoder.encode(completionMsg))

          console.log('Batch generation completed:', { requestId, daysGenerated: dayCount })
          controller.close()

        } catch (error) {
          console.error('Streaming error:', { requestId, error: error instanceof Error ? error.message : String(error) })
          
          const errorMsg = JSON.stringify({
            type: 'error',
            message: 'Generation failed. Please try again.'
          }) + '\n'
          controller.enqueue(encoder.encode(errorMsg))
          controller.close()
        }
      }
    })

    return new NextResponse(readableStream, { headers })

  } catch (error) {
    console.error('Curriculum generate error:', { 
      requestId, 
      error: error instanceof Error ? error.message : String(error) 
    })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}