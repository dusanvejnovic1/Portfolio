import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { CURRICULUM_OUTLINE_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { CurriculumOutlineResponse } from '@/types/modes'

// Request validation schema
const CurriculumOutlineRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationDays: z.number().min(1).max(180),
  constraints: z.object({
    timePerDayMins: z.number().min(30).max(480).optional(),
    os: z.string().max(50).optional(),
    cloud: z.string().max(50).optional(),
    tools: z.array(z.string().max(50)).max(10).optional(),
    prerequisitesOk: z.boolean().optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Curriculum outline request:', { requestId, timestamp: new Date().toISOString() })

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
    const parsed = CurriculumOutlineRequestSchema.parse(body)

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
    const validation = await validateITContent(parsed.topic, 'curriculum')
    if (!validation.isValid) {
      console.log('IT content validation failed:', { requestId, errors: validation.errors })
      return NextResponse.json(
        { error: validation.errors[0] || 'Content validation failed' },
        { status: 400 }
      )
    }

    // Build constraints context
    let constraintsText = ''
    if (parsed.constraints) {
      const constraints = []
      if (parsed.constraints.timePerDayMins) {
        constraints.push(`${parsed.constraints.timePerDayMins} minutes per day`)
      }
      if (parsed.constraints.os) {
        constraints.push(`OS: ${parsed.constraints.os}`)
      }
      if (parsed.constraints.cloud) {
        constraints.push(`Cloud: ${parsed.constraints.cloud}`)
      }
      if (parsed.constraints.tools?.length) {
        constraints.push(`Tools: ${parsed.constraints.tools.join(', ')}`)
      }
      if (parsed.constraints.prerequisitesOk === false) {
        constraints.push('Assume no prerequisites')
      }
      
      if (constraints.length > 0) {
        constraintsText = `\n\nConstraints: ${constraints.join('; ')}`
      }
    }

    // Generate curriculum outline
    const prompt = `${CURRICULUM_OUTLINE_PROMPT}

Topic: ${parsed.topic}
Level: ${parsed.level}
Duration: ${parsed.durationDays} days${constraintsText}

Focus on practical IT skills with progressive difficulty. Create a realistic learning progression.`

    console.log('Generating outline:', { requestId, topic: parsed.topic, level: parsed.level, duration: parsed.durationDays })

    const response = await generateResponse(
      prompt,
      IT_TUTOR_SYSTEM_PROMPT,
      { model: 'quality', maxTokens: 1500, temperature: 0.3 }
    )

    // Parse the JSON response
    let outlineData: CurriculumOutlineResponse
    try {
      outlineData = JSON.parse(response.trim())
      
      // Validate response structure
      if (!outlineData.outline || !Array.isArray(outlineData.outline)) {
        throw new Error('Invalid outline structure')
      }
    } catch (parseError) {
      console.error('Failed to parse outline response:', { requestId, error: parseError, response: response.substring(0, 200) })
      return NextResponse.json(
        { error: 'Failed to generate valid curriculum outline' },
        { status: 500 }
      )
    }

    // Post-moderation on generated content
    const outlineText = outlineData.outline.map(w => `${w.focus} ${w.notes || ''}`).join(' ')
    const postModeration = await validateITContent(outlineText, 'curriculum')
    
    if (postModeration.warnings.length > 0) {
      console.warn('Generated content warnings:', { requestId, warnings: postModeration.warnings })
    }

    console.log('Outline generated successfully:', { requestId, weeksCount: outlineData.outline.length })

    return NextResponse.json(outlineData, { status: 200 })

  } catch (error) {
    console.error('Curriculum outline error:', { requestId, error: error instanceof Error ? error.message : String(error) })
    
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