import { NextRequest, NextResponse } from 'next/server'
import { generateResponse } from '@/lib/llm'
import { preModerate } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { ASSESSMENT_SCORE_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { AssessmentRequestSchema, AssessmentResponseSchema } from '@/lib/schemas/modes'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Assessment scoring request:', { requestId, timestamp: new Date().toISOString() })

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
    const parsed = AssessmentRequestSchema.parse(body)

    // Content moderation on submission
    const submissionModeration = await preModerate(parsed.submission, { maxLength: 5000 })
    if (!submissionModeration.allowed) {
      console.log('Submission content blocked by moderation:', { requestId, reason: submissionModeration.reason })
      return NextResponse.json(
        { error: submissionModeration.reason || 'Submission content not allowed' },
        { status: 400 }
      )
    }

    // Check if submission is a URL
    const isUrl = parsed.submission.startsWith('http://') || parsed.submission.startsWith('https://')
    let submissionText = parsed.submission

    if (isUrl) {
      // For URLs, we'll work with what we have and note it's a link
      submissionText = `[Link to submission: ${parsed.submission}]\n\nNote: This is a link submission. Please evaluate based on the assignment requirements and ask the student to provide more details if needed.`
    }

    // Since we're prompt-only, no assignment text validation needed - using rubric directly
    console.log('Scoring assessment:', { 
      requestId, 
      hasRubric: !!(parsed.rubric && parsed.rubric.length > 0),
      submissionLength: submissionText.length,
      isUrl
    })

    // Validate rubric weights if provided
    if (parsed.rubric && parsed.rubric.length > 0) {
      const totalWeight = parsed.rubric.reduce((sum, criterion) => sum + criterion.weight, 0)
      if (Math.abs(totalWeight - 1.0) > 0.1) {
        console.warn('Rubric weights do not sum to 1.0:', { requestId, totalWeight })
        return NextResponse.json(
          { error: 'Rubric weights must sum to approximately 1.0' },
          { status: 400 }
        )
      }
    }

    // Build rubric context
    let rubricContext = ''
    if (parsed.rubric && parsed.rubric.length > 0) {
      rubricContext = '\n\nRubric Criteria:\n'
      parsed.rubric.forEach(criterion => {
        rubricContext += `- ${criterion.name} (Weight: ${criterion.weight}): ${criterion.description}\n`
        criterion.levels.forEach(level => {
          rubricContext += `  * ${level.score}/5: ${level.description}\n`
        })
      })
    }

    // Generate assessment
    const prompt = `${ASSESSMENT_SCORE_PROMPT}

SUBMISSION:
${submissionText}${rubricContext}

Provide detailed, constructive feedback with specific evidence from the submission. Score fairly based on the rubric criteria.`

    const response = await generateResponse(
      prompt,
      IT_TUTOR_SYSTEM_PROMPT,
      { model: 'quality', maxTokens: 2000, temperature: 0.2 }
    )

    // Parse the JSON response
    let assessmentResult
    try {
      assessmentResult = JSON.parse(response.trim())
      
      // Validate response structure
      const validatedResponse = AssessmentResponseSchema.parse(assessmentResult)
      
      console.log('Assessment scoring successful:', { 
        requestId, 
        overallScore: validatedResponse.overallScore 
      })
      
      return NextResponse.json(validatedResponse)

    } catch (parseError) {
      console.error('Failed to parse assessment response:', { 
        requestId, 
        error: parseError, 
        response: response.substring(0, 200) + '...' 
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

    console.error('Assessment scoring error:', { requestId, error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}