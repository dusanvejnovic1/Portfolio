import { NextRequest, NextResponse } from 'next/server'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { RESOURCES_ANNOTATION_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { ResourcesRequestSchema, ResourcesResponseSchema } from '@/lib/schemas/modes'
import { resolveSearchProvider, SearchResult } from '@/lib/search/providers'

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  console.log('Resources search request:', { requestId, timestamp: new Date().toISOString() })

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
    const parsed = ResourcesRequestSchema.parse(body)

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
    const validation = await validateITContent(parsed.topic, 'resources')
    if (!validation.isValid) {
      console.log('IT content validation failed:', { requestId, errors: validation.errors })
      return NextResponse.json(
        { error: validation.errors[0] || 'Content validation failed' },
        { status: 400 }
      )
    }

    const maxResults = parsed.maxResults || 10
    const subtopicsText = parsed.subtopics ? `, focusing on subtopics: ${parsed.subtopics.join(', ')}` : ''

    console.log('Generating resources with AI:', { 
      requestId, 
      topic: parsed.topic, 
      maxResults,
      subtopics: parsed.subtopics
    })

    // Try to get search provider first for enhanced results
    const searchProvider = resolveSearchProvider()
    let searchResults: SearchResult[] = []
    let searchVerified = false // Track if results are from verified provider
    
    if (searchProvider) {
      console.log('Using search provider:', { requestId, provider: searchProvider.name })
      try {
        // Build a focused search query for the topic
        const query = `${parsed.topic} tutorial documentation guide`
        searchResults = await searchProvider.search(query, { count: 5 })
        searchVerified = true
        console.log('Provider search results:', { requestId, count: searchResults.length })
      } catch (error) {
        console.warn('Search provider failed, falling back to AI-only:', { requestId, error })
      }
    } else {
      console.log('No search provider configured, using AI-only approach:', { requestId })
    }

    // Create enhanced prompt with search results if available
    let searchContext = ''
    if (searchResults.length > 0) {
      searchContext = `

Here are some real search results to help generate realistic resources:
${searchResults.map((result, index) => 
`${index + 1}. ${result.title}
   URL: ${result.url}
   Snippet: ${result.snippet}`
).join('\n\n')}

Use these as inspiration but generate additional diverse resources to reach ${maxResults} total items.`
    }

    // Create prompt for AI to generate resources
    const prompt = `${RESOURCES_ANNOTATION_PROMPT}

Topic: ${parsed.topic}${subtopicsText}
Max Results: ${maxResults}${searchContext}

Generate ${maxResults} high-quality educational resources for learning about "${parsed.topic}". Include a mix of documentation, tutorials, videos, and official sources. Each resource should be realistic and educational.

Return ONLY a JSON object with this exact structure:
{
  "resources": [
    {
      "title": "Resource Title",
      "url": "https://example.com/resource",
      "source": "web",
      "publisher": "Publisher Name",
      "length": "5 min read",
      "publishedAt": "2024-01-15",
      "relevanceScore": 85,
      "relevanceRationale": "Why this resource is relevant and useful",
      "keyTakeaways": ["Key point 1", "Key point 2", "Key point 3"],
      "isOfficial": false,
      "badges": ["recent", "beginner-friendly"],
      "verified": ${searchVerified}
    }
  ],
  "meta": {
    "totalResults": ${maxResults},
    "searchQuery": "${parsed.topic}",
    "verified": ${searchVerified},
    "generatedAt": "${new Date().toISOString()}"
  }
}`

    console.log('Requesting AI-generated resources:', { requestId })

    const aiResponse = await generateResponse(
      prompt,
      IT_TUTOR_SYSTEM_PROMPT,
      { model: 'default', maxTokens: 3000, temperature: 0.3 }
    )

    // Parse the JSON response
    let resourcesData
    try {
      resourcesData = JSON.parse(aiResponse.trim())
      
      // Validate response structure
      const validatedResponse = ResourcesResponseSchema.parse(resourcesData)
      
      console.log('AI resource generation successful:', { 
        requestId, 
        resourceCount: validatedResponse.resources.length 
      })
      
      return NextResponse.json(validatedResponse)

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', { 
        requestId, 
        error: parseError, 
        response: aiResponse.substring(0, 200) + '...' 
      })
      
      return NextResponse.json(
        { 
          error: 'Service temporarily unavailable - invalid response format',
          diagnostic: {
            type: 'json_parse_error',
            message: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
            responsePreview: aiResponse.substring(0, 200)
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

    console.error('Resources search error:', { requestId, error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}