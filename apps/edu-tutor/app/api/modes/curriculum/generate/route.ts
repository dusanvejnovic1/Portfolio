import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { openai } from '@/lib/openai'
import { checkRateLimit } from '@/lib/rateLimit'
import { CurriculumGenerateRequestSchema } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPrompt } from '@/lib/prompts/curriculum'
import { acceptsSSE, createSSEHeaders } from '@/lib/sse'

export const runtime = 'nodejs'

type OpenAIClient = ReturnType<typeof openai>

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Curriculum generate request:', { requestId, timestamp: new Date().toISOString() })

  try {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

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

    console.log('Validated request:', { requestId, topic: parsed.topic, level: parsed.level, durationDays: parsed.durationDays })

    // Check if client accepts SSE
    const useSSE = acceptsSSE(request)
    console.log('Response format:', { requestId, useSSE })

    // Get OpenAI model
    const model = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
    const client = openai()

    if (useSSE) {
      // SSE streaming response
      return createSSEResponse(client, model, parsed, request, requestId)
    } else {
      // JSON fallback response
      return createJSONResponse(client, model, parsed, requestId)
    }

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

    // Provide specific error messages for API key issues
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('Incorrect API key') || error.message.includes('invalid_api_key')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your API key configuration.' },
          { status: 401 }
        )
      } else if (error.message.includes('model') || error.message.includes('Model')) {
        return NextResponse.json(
          { error: `Model configuration error. Please verify the model is available for your API key.` },
          { status: 400 }
        )
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'OpenAI rate limit reached. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Create SSE streaming response
 */
async function createSSEResponse(
  client: OpenAIClient, 
  model: string, 
  request: z.infer<typeof CurriculumGenerateRequestSchema>,
  httpRequest: NextRequest,
  requestId: string
) {
  const headers = createSSEHeaders(
    httpRequest.headers.get('origin') || undefined,
    process.env.ALLOWED_ORIGIN
  )

  const encoder = new TextEncoder()
  
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Generate curriculum days sequentially
        const generatedDays = []
        
        for (let dayIndex = 1; dayIndex <= request.durationDays; dayIndex++) {
          try {
            const dayContent = await generateSingleDay(
              client, 
              model, 
              request.topic, 
              request.level, 
              dayIndex, 
              request.durationDays,
              request.goals
            )

            if (dayContent) {
              generatedDays.push(dayContent)
              
              // Send day event
              const dayEvent = {
                type: 'day',
                day: dayContent, // For compatibility with client expecting msg.day
                content: dayContent, // For compatibility with client expecting msg.content
                index: dayIndex,
                title: dayContent.title,
                totalDays: request.durationDays
              }
              
              const eventLine = JSON.stringify(dayEvent) + '\n'
              controller.enqueue(encoder.encode(eventLine))
              
              console.log('Generated day:', { requestId, day: dayIndex, title: dayContent.title })
            }
          } catch (dayError) {
            console.error('Day generation failed:', { requestId, day: dayIndex, error: dayError })
            
            // Check if it's a network error (OpenAI not accessible)
            if (dayError instanceof Error && (
              dayError.message.includes('Connection error') ||
              dayError.message.includes('ENOTFOUND') ||
              dayError.message.includes('getaddrinfo')
            )) {
              // Provide mock curriculum day data for demo purposes
              const mockDay: CurriculumDayContent = {
                day: dayIndex,
                title: `Day ${dayIndex}: Demo Content - ${request.topic}`,
                summary: `This is demo content for Day ${dayIndex}. In a real deployment with proper OpenAI API access, this would contain comprehensive learning material for "${request.topic}" at ${request.level} level.`,
                goals: [
                  `Understanding core concepts for day ${dayIndex}`,
                  `Practical application of ${request.topic}`,
                  `Building on previous knowledge`
                ],
                theorySteps: [
                  `Review fundamental concepts`,
                  `Explore new theoretical frameworks`,
                  `Connect theory to practice`
                ],
                handsOnSteps: [
                  `Complete practical exercises`,
                  `Apply concepts in real scenarios`,
                  `Build sample projects`
                ],
                resources: [
                  {
                    title: "Demo Documentation",
                    url: "https://example.com/docs",
                    type: "documentation"
                  }
                ],
                assignment: `Practice assignment for ${request.topic} - Day ${dayIndex} focus`,
                checkForUnderstanding: [
                  `Can you explain the main concepts?`,
                  `How would you apply this knowledge?`,
                  `What challenges did you encounter?`
                ]
              }
              
              generatedDays.push(mockDay)
              
              // Send day event with mock data
              const dayEvent = {
                type: 'day',
                day: mockDay,
                content: mockDay,
                index: dayIndex,
                title: mockDay.title,
                totalDays: request.durationDays
              }
              
              const eventLine = JSON.stringify(dayEvent) + '\n'
              controller.enqueue(encoder.encode(eventLine))
              
              console.log('Generated mock day:', { requestId, day: dayIndex, title: mockDay.title })
            } else {
              // Send error event for other types of errors
              const errorEvent = {
                type: 'error',
                error: `Failed to generate day ${dayIndex}: ${dayError instanceof Error ? dayError.message : String(dayError)}`
              }
              
              const errorLine = JSON.stringify(errorEvent) + '\n'
              controller.enqueue(encoder.encode(errorLine))
              controller.close()
              return
            }
          }
        }

        // Send done event
        const doneEvent = {
          type: 'done',
          totalGenerated: generatedDays.length
        }
        
        const doneLine = JSON.stringify(doneEvent) + '\n'
        controller.enqueue(encoder.encode(doneLine))
        controller.close()

        console.log('Curriculum generation completed:', { requestId, totalDays: generatedDays.length })

      } catch (error) {
        console.error('SSE streaming error:', { requestId, error })
        
        const errorEvent = {
          type: 'error',
          error: 'Generation failed. Please try again.'
        }
        
        const errorLine = JSON.stringify(errorEvent) + '\n'
        controller.enqueue(encoder.encode(errorLine))
        controller.close()
      }
    }
  })

  return new NextResponse(readableStream, { headers })
}

/**
 * Create JSON fallback response  
 */
async function createJSONResponse(
  client: OpenAIClient,
  model: string,
  request: z.infer<typeof CurriculumGenerateRequestSchema>,
  requestId: string
) {
  try {
    const generatedDays = []
    
    // Generate all days sequentially  
    for (let dayIndex = 1; dayIndex <= request.durationDays; dayIndex++) {
      const dayContent = await generateSingleDay(
        client, 
        model, 
        request.topic, 
        request.level, 
        dayIndex, 
        request.durationDays,
        request.goals
      )

      if (dayContent) {
        generatedDays.push(dayContent)
        console.log('Generated day:', { requestId, day: dayIndex, title: dayContent.title })
      }
    }

    return NextResponse.json({
      days: generatedDays,
      totalDays: request.durationDays
    })

  } catch (error) {
    console.error('JSON generation error:', { requestId, error })
    return NextResponse.json(
      { error: 'Generation failed. Please try again.' },
      { status: 500 }
    )
  }
}

interface CurriculumDayContent {
  day: number
  title: string
  summary: string
  goals: string[]
  theorySteps: string[]
  handsOnSteps: string[]
  resources: Array<{
    title: string
    url: string
    type: 'documentation' | 'video' | 'tutorial' | 'tool'
  }>
  assignment: string
  checkForUnderstanding: string[]
}

/**
 * Generate a single curriculum day using OpenAI
 */
async function generateSingleDay(
  client: OpenAIClient,
  model: string, 
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  dayIndex: number,
  totalDays: number,
  goals?: string[]
): Promise<CurriculumDayContent> {
  
  const systemPrompt = curriculumSystemPrompt()
  const userPrompt = `Generate day ${dayIndex} of ${totalDays} for the curriculum.

${curriculumUserPrompt(topic, level, totalDays, goals)}

Focus specifically on Day ${dayIndex}. Respond with a single JSON object following this exact format:

{
  "day": ${dayIndex},
  "title": "Day ${dayIndex} Title",
  "summary": "Brief summary of what students will learn",
  "goals": ["learning goal 1", "learning goal 2"],
  "theorySteps": ["theory step 1", "theory step 2"],
  "handsOnSteps": ["hands-on step 1", "hands-on step 2"], 
  "resources": [{"title": "Resource Name", "url": "https://example.com", "type": "documentation"}],
  "assignment": "Practical assignment description",
  "checkForUnderstanding": ["check question 1", "check question 2"]
}

Only return the JSON object, no additional text.`

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1500,
    temperature: 0.3
  })

  const response = completion.choices[0]?.message?.content?.trim()
  if (!response) {
    throw new Error('No response from OpenAI')
  }

  try {
    const parsed = JSON.parse(response)
    
    // Validate required fields
    if (!parsed.day || !parsed.title || !parsed.summary) {
      throw new Error('Invalid day structure returned from OpenAI')
    }
    
    return parsed
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', { response, error: parseError })
    throw new Error('Invalid JSON response from OpenAI')
  }
}