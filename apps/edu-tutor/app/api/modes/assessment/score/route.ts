import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { ASSESSMENT_SCORE_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { AssessmentResult } from '@/types/modes'

// Request validation schema
const RubricCriterionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  weight: z.number().min(0).max(1),
  levels: z.array(z.object({
    score: z.number().min(0).max(5),
    description: z.string().min(1).max(200)
  })).min(1)
})

const AssessmentScoreRequestSchema = z.object({
  assignmentText: z.string().min(10).max(5000),
  submissionTextOrLink: z.string().min(5).max(3000),
  rubric: z.array(RubricCriterionSchema).optional()
})

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
    const parsed = AssessmentScoreRequestSchema.parse(body)

    // Content moderation
    const assignmentModeration = await preModerate(parsed.assignmentText, { maxLength: 5000 })
    if (!assignmentModeration.allowed) {
      console.log('Assignment content blocked by moderation:', { requestId, reason: assignmentModeration.reason })
      return NextResponse.json(
        { error: assignmentModeration.reason || 'Assignment content not allowed' },
        { status: 400 }
      )
    }

    const submissionModeration = await preModerate(parsed.submissionTextOrLink, { maxLength: 3000 })
    if (!submissionModeration.allowed) {
      console.log('Submission content blocked by moderation:', { requestId, reason: submissionModeration.reason })
      return NextResponse.json(
        { error: submissionModeration.reason || 'Submission content not allowed' },
        { status: 400 }
      )
    }

    // Check if submission is a URL
    const isUrl = parsed.submissionTextOrLink.startsWith('http://') || parsed.submissionTextOrLink.startsWith('https://')
    let submissionText = parsed.submissionTextOrLink

    if (isUrl) {
      // For URLs, we'll work with what we have and note it's a link
      submissionText = `[Link to submission: ${parsed.submissionTextOrLink}]\n\nNote: This is a link submission. Please evaluate based on the assignment requirements and ask the student to provide more details if needed.`
    }

    // IT content validation
    const assignmentValidation = await validateITContent(parsed.assignmentText, 'assessment')
    if (!assignmentValidation.isValid) {
      console.log('Assignment validation failed:', { requestId, errors: assignmentValidation.errors })
      return NextResponse.json(
        { error: assignmentValidation.errors[0] || 'Assignment validation failed' },
        { status: 400 }
      )
    }

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

ASSIGNMENT:
${parsed.assignmentText}

SUBMISSION:
${submissionText}${rubricContext}

Provide detailed, constructive feedback with specific evidence from the submission. Score fairly based on the assignment requirements and rubric criteria.`

    console.log('Scoring assessment:', { 
      requestId, 
      assignmentLength: parsed.assignmentText.length,
      submissionLength: submissionText.length,
      isUrlSubmission: isUrl,
      hasCustomRubric: !!parsed.rubric?.length
    })

    const response = await generateResponse(
      prompt,
      IT_TUTOR_SYSTEM_PROMPT,
      { model: 'quality', maxTokens: 2000, temperature: 0.2 }
    )

    // Parse the JSON response
    let assessmentResult: AssessmentResult
    try {
      assessmentResult = JSON.parse(response.trim())
      
      // Validate response structure
      if (typeof assessmentResult.overallScore !== 'number' ||
          !assessmentResult.summary ||
          !Array.isArray(assessmentResult.whatWasGood) ||
          !Array.isArray(assessmentResult.needsImprovement) ||
          !Array.isArray(assessmentResult.mustFix) ||
          !Array.isArray(assessmentResult.nextSteps) ||
          !Array.isArray(assessmentResult.rubricBreakdown)) {
        throw new Error('Invalid assessment result structure')
      }

      // Validate score range
      if (assessmentResult.overallScore < 0 || assessmentResult.overallScore > 5) {
        throw new Error('Overall score must be between 0 and 5')
      }

      // Validate score is in 0.5 increments
      if ((assessmentResult.overallScore * 2) % 1 !== 0) {
        console.warn('Score not in 0.5 increments, rounding:', { 
          requestId, 
          originalScore: assessmentResult.overallScore 
        })
        assessmentResult.overallScore = Math.round(assessmentResult.overallScore * 2) / 2
      }

    } catch (parseError) {
      console.error('Failed to parse assessment response:', { 
        requestId, 
        error: parseError, 
        response: response.substring(0, 500) 
      })
      return NextResponse.json(
        { error: 'Failed to generate valid assessment result' },
        { status: 500 }
      )
    }

    // Post-moderation on generated content
    const feedbackText = `${assessmentResult.summary} ${assessmentResult.whatWasGood.join(' ')} ${assessmentResult.needsImprovement.join(' ')}`
    const postModeration = await validateITContent(feedbackText, 'assessment')
    
    if (postModeration.warnings.length > 0) {
      console.warn('Generated assessment warnings:', { requestId, warnings: postModeration.warnings })
    }

    // Add metadata to response
    const enrichedResult = {
      ...assessmentResult,
      meta: {
        requestId,
        assessedAt: new Date().toISOString(),
        isUrlSubmission: isUrl,
        hasCustomRubric: !!parsed.rubric?.length,
        submissionLength: parsed.submissionTextOrLink.length
      }
    }

    console.log('Assessment completed successfully:', { 
      requestId, 
      overallScore: assessmentResult.overallScore,
      rubricItems: assessmentResult.rubricBreakdown.length
    })

    return NextResponse.json(enrichedResult, { status: 200 })

  } catch (error) {
    console.error('Assessment scoring error:', { 
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