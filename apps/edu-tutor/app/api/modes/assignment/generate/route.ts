import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { ASSIGNMENT_GENERATE_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { AssignmentRequestSchema, AssignmentResponseSchema } from '@/lib/schemas/modes'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Assignment generation request:', { requestId, timestamp: new Date().toISOString() })

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
    const parsed = AssignmentRequestSchema.parse(body)

    // Content moderation
    const moderation = await preModerate(parsed.topic, { maxLength: 200 })
    if (!moderation.allowed) {
      console.log('Content blocked by moderation:', { requestId, reason: moderation.reason })
      return NextResponse.json(
        { error: moderation.reason || 'Content not allowed' },
        { status: 400 }
      )
    }

    // IT content validation
    const validation = await validateITContent(parsed.topic, 'assignment')
    if (!validation.isValid) {
      console.log('IT content validation failed:', { requestId, errors: validation.errors })
      return NextResponse.json(
        { error: validation.errors[0] || 'Content validation failed' },
        { status: 400 }
      )
    }

    // Build context for assignment generation
    let contextText = ''
    
    if (parsed.timeBudgetHrs) {
      contextText += `\nTime budget: ${parsed.timeBudgetHrs} hours`
    }
    
    if (parsed.constraints) {
      contextText += `\nConstraints: ${JSON.stringify(parsed.constraints)}`
    }

    const guidanceNote = parsed.guidanceStyle === 'solutions' 
      ? '\nInclude solution outline in the response for each variant.'
      : '\nProvide hints but avoid full solutions unless specifically requested.'

    // Generate assignments
    const prompt = `${ASSIGNMENT_GENERATE_PROMPT}

Topic: ${parsed.topic}
Difficulty: ${parsed.difficulty}${contextText}${guidanceNote}

Create 3 distinct real-world scenarios that teach practical IT skills. Each variant should have different contexts but similar learning objectives. Include comprehensive rubrics with weighted criteria.`

    console.log('Generating assignments:', { 
      requestId, 
      topic: parsed.topic, 
      difficulty: parsed.difficulty,
      guidanceStyle: parsed.guidanceStyle 
    })

    const response = await generateResponse(
      prompt,
      IT_TUTOR_SYSTEM_PROMPT,
      { model: 'quality', maxTokens: 4000, temperature: 0.4 }
    )

    // Parse the JSON response
    let assignmentData
    try {
      assignmentData = JSON.parse(response.trim())
      
      // Validate response structure
      const validatedResponse = AssignmentResponseSchema.parse(assignmentData)
      
      console.log('Assignment generation successful:', { 
        requestId, 
        variantCount: validatedResponse.set.length 
      })

      return NextResponse.json(validatedResponse)

    } catch (parseError) {
      console.error('Failed to parse assignment response:', { 
        requestId, 
        error: parseError, 
        response: response.substring(0, 500) + '...'
      })
      
      return NextResponse.json(
        { 
          error: 'Service temporarily unavailable - invalid response format',
          diagnostic: {
            type: 'json_parse_error',
            message: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
            responsePreview: response.substring(0, 200)
          }
        },
        { status: 502 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      console.log('Request validation failed:', { requestId, error })
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    console.error('Assignment generation error:', { requestId, error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}