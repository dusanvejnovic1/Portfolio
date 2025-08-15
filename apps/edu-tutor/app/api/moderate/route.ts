import { NextRequest } from 'next/server'
import { moderateContent } from '@/lib/openai'
import { moderateRequestSchema } from '@/lib/validation'

// Use Node.js runtime for in-memory rate limiting
export const runtime = 'nodejs'

function getCORSHeaders() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'development' ? '*' : '*')
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Input validation with zod
    const validationResult = moderateRequestSchema.safeParse(body)
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Invalid request format'
      return Response.json(
        { error: errorMessage },
        { 
          status: 400,
          headers: getCORSHeaders()
        }
      )
    }
    
    const { input } = validationResult.data
    
    const moderationResult = await moderateContent(input)
    
    return Response.json({
      flagged: moderationResult.flagged,
      categories: moderationResult.categories,
      category_scores: moderationResult.category_scores
    }, {
      headers: getCORSHeaders()
    })
  } catch (error) {
    console.error('Moderation API error:', error)
    return Response.json(
      { error: 'Failed to moderate content' },
      { 
        status: 500,
        headers: getCORSHeaders()
      }
    )
  }
}