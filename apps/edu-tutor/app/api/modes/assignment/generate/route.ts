import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { ASSIGNMENT_GENERATE_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { AssignmentGenerateResponse } from '@/types/modes'

// Request validation schema
const AssignmentGenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  skills: z.array(z.string().max(100)).max(10).optional(),
  constraints: z.any().optional(), // Flexible for various constraint types
  timeBudgetHrs: z.number().min(0.5).max(40).optional(),
  guidanceStyle: z.enum(['hints', 'solutions']).optional()
})

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
    const parsed = AssignmentGenerateRequestSchema.parse(body)

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
    
    if (parsed.skills && parsed.skills.length > 0) {
      contextText += `\nFocus on these skills: ${parsed.skills.join(', ')}`
    }
    
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
    let assignmentData: AssignmentGenerateResponse
    try {
      assignmentData = JSON.parse(response.trim())
      
      // Validate response structure
      if (!assignmentData.set || !Array.isArray(assignmentData.set) || assignmentData.set.length !== 3) {
        throw new Error('Invalid assignment set structure - must contain exactly 3 variants')
      }

      // Validate each variant has required fields
      for (const variant of assignmentData.set) {
        if (!variant.id || !variant.title || !variant.scenario || 
            !variant.objectives || !variant.steps || !variant.deliverables || 
            !variant.rubric) {
          throw new Error(`Incomplete assignment variant: ${variant.id || 'unknown'}`)
        }

        // Validate rubric weights sum to ~1.0
        const totalWeight = variant.rubric.reduce((sum, criterion) => sum + criterion.weight, 0)
        if (Math.abs(totalWeight - 1.0) > 0.1) {
          console.warn('Rubric weights do not sum to 1.0:', { 
            requestId, 
            variantId: variant.id, 
            totalWeight 
          })
        }
      }
    } catch (parseError) {
      console.error('Failed to parse assignment response:', { 
        requestId, 
        error: parseError, 
        response: response.substring(0, 500) 
      })
      return NextResponse.json(
        { error: 'Failed to generate valid assignment variants' },
        { status: 500 }
      )
    }

    // Post-moderation on generated content
    const allText = assignmentData.set.map(variant => 
      `${variant.title} ${variant.scenario} ${variant.objectives.join(' ')}`
    ).join(' ')
    
    const postModeration = await validateITContent(allText, 'assignment')
    
    if (postModeration.warnings.length > 0) {
      console.warn('Generated content warnings:', { requestId, warnings: postModeration.warnings })
    }

    // Add metadata to response
    const enrichedResponse = {
      ...assignmentData,
      meta: {
        requestId,
        generatedAt: new Date().toISOString(),
        topic: parsed.topic,
        difficulty: parsed.difficulty,
        guidanceStyle: parsed.guidanceStyle || 'hints',
        timeBudgetHrs: parsed.timeBudgetHrs
      }
    }

    console.log('Assignments generated successfully:', { 
      requestId, 
      variantCount: assignmentData.set.length,
      topics: assignmentData.set.map(v => v.title)
    })

    return NextResponse.json(enrichedResponse, { status: 200 })

  } catch (error) {
    console.error('Assignment generation error:', { 
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