import { NextRequest } from 'next/server'
import { moderateContent } from '@/lib/openai'

// Use Node.js runtime for in-memory rate limiting
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input } = body
    
    if (!input || typeof input !== 'string') {
      return Response.json(
        { error: 'Input is required and must be a string' },
        { status: 400 }
      )
    }
    
    if (input.length > 1500) {
      return Response.json(
        { error: 'Input too long. Please limit to 1500 characters.' },
        { status: 400 }
      )
    }
    
    const moderationResult = await moderateContent(input)
    
    return Response.json({
      flagged: moderationResult.flagged,
      categories: moderationResult.categories,
      category_scores: moderationResult.category_scores
    })
  } catch (error) {
    console.error('Moderation API error:', error)
    return Response.json(
      { error: 'Failed to moderate content' },
      { status: 500 }
    )
  }
}