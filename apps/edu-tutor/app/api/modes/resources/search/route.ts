import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateResponse } from '@/lib/llm'
import { preModerate, validateITContent } from '@/lib/moderation'
import { checkRateLimit } from '@/lib/rateLimit'
import { RESOURCES_ANNOTATION_PROMPT, IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'
import { searchITResources, extractWebMetadata, BingWebPage } from '@/lib/retrieval/webSearch'
import { searchITVideos, getVideoDetails, parseYouTubeDuration, formatDuration, YouTubeVideo, YouTubeVideoDetails } from '@/lib/retrieval/youtube'
import { rankAndFilterResults } from '@/lib/retrieval/rank'
import { ResourcesSearchResponse, ResourceCard } from '@/types/modes'

// Request validation schema
const ResourcesSearchRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  preferences: z.object({
    video: z.boolean().optional(),
    docs: z.boolean().optional(),
    course: z.boolean().optional()
  }).optional(),
  preferOfficial: z.boolean().optional()
})

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
    const parsed = ResourcesSearchRequestSchema.parse(body)

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

    const level = parsed.level || 'Beginner'
    const preferences = parsed.preferences || { video: true, docs: true, course: true }
    const preferOfficial = parsed.preferOfficial ?? true

    console.log('Searching resources:', { 
      requestId, 
      topic: parsed.topic, 
      level,
      preferences,
      preferOfficial
    })

    // Perform searches
    const searchPromises: [Promise<BingWebPage[]>, Promise<YouTubeVideo[]>] = [
      searchITResources(parsed.topic, {
        level,
        preferOfficial,
        includeRecent: true,
        count: 15
      }).catch(error => {
        console.warn('Web search failed:', { requestId, error })
        return []
      }),
      
      // YouTube search if video preference is enabled
      preferences.video !== false 
        ? searchITVideos(parsed.topic, {
            level,
            includeRecent: true,
            maxResults: 10
          }).catch(error => {
            console.warn('YouTube search failed:', { requestId, error })
            return []
          })
        : Promise.resolve([])
    ]

    const [webResults, youtubeResults] = await Promise.all(searchPromises)

    console.log('Search results retrieved:', { 
      requestId, 
      webCount: webResults.length,
      videoCount: youtubeResults.length
    })

    // Get video details for YouTube results
    let videoDetails: YouTubeVideoDetails[] = []
    if (youtubeResults.length > 0) {
      const videoIds = youtubeResults.map((video: YouTubeVideo) => video.id.videoId)
      videoDetails = await getVideoDetails(videoIds).catch(error => {
        console.warn('Failed to get video details:', { requestId, error })
        return []
      })
    }

    // Convert search results to ResourceCard format
    const rawResourceCards: ResourceCard[] = []

    // Process web results
    webResults.forEach((result: BingWebPage) => {
      const metadata = extractWebMetadata(result)
      
      rawResourceCards.push({
        title: result.name,
        url: result.url,
        source: 'web',
        publisher: metadata.publisher,
        publishedAt: result.dateLastCrawled,
        relevanceScore: 50, // Base score, will be updated by AI
        relevanceRationale: 'Web search result',
        keyTakeaways: [result.snippet],
        isOfficial: metadata.isOfficial,
        badges: metadata.isOfficial ? ['official'] : []
      })
    })

    // Process YouTube results
    youtubeResults.forEach((video: YouTubeVideo) => {
      const videoDetail = videoDetails.find((d: YouTubeVideoDetails) => d.id === video.id.videoId)
      let duration = undefined
      let durationFormatted = undefined

      if (videoDetail?.contentDetails?.duration) {
        duration = parseYouTubeDuration(videoDetail.contentDetails.duration)
        durationFormatted = formatDuration(duration)
      }

      const badges = []
      if (duration && duration >= 300 && duration <= 1800) { // 5-30 minutes
        badges.push('good-length')
      }
      
      const monthsAgo = (Date.now() - new Date(video.snippet.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsAgo < 6) {
        badges.push('recent')
      }

      rawResourceCards.push({
        title: video.snippet.title,
        url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
        source: 'youtube',
        publisher: video.snippet.channelTitle,
        length: durationFormatted,
        duration,
        publishedAt: video.snippet.publishedAt,
        relevanceScore: 50, // Base score, will be updated by AI
        relevanceRationale: 'YouTube search result',
        keyTakeaways: [video.snippet.description.substring(0, 200)],
        badges: badges.length > 0 ? badges as Array<'official' | 'recent' | 'comprehensive' | 'beginner-friendly' | 'advanced'> : undefined
      })
    })

    // Rank and filter results
    const rankedResults = rankAndFilterResults(rawResourceCards, parsed.topic, {
      level,
      preferences,
      maxResults: 20,
      diversify: true
    })

    console.log('Results ranked and filtered:', { 
      requestId, 
      originalCount: rawResourceCards.length,
      finalCount: rankedResults.length
    })

    // Use AI to annotate and improve the top results
    if (rankedResults.length > 0) {
      try {
        const searchResultsText = rankedResults.slice(0, 15).map(result => 
          `Title: ${result.title}\nURL: ${result.url}\nSource: ${result.source}\nPublisher: ${result.publisher || 'Unknown'}\nDescription: ${result.keyTakeaways[0] || ''}`
        ).join('\n\n')

        const annotationPrompt = `${RESOURCES_ANNOTATION_PROMPT}

Topic: ${parsed.topic}
Level: ${level}
Preferences: ${JSON.stringify(preferences)}

Search Results:
${searchResultsText}

Analyze these results and provide enhanced ResourceCards with improved relevance scores, key takeaways, and appropriate badges.`

        console.log('Requesting AI annotation:', { requestId, resultsToAnnotate: rankedResults.slice(0, 15).length })

        const aiResponse = await generateResponse(
          annotationPrompt,
          IT_TUTOR_SYSTEM_PROMPT,
          { model: 'default', maxTokens: 3000, temperature: 0.3 }
        )

        // Try to parse AI-enhanced results
        try {
          const aiData = JSON.parse(aiResponse.trim())
          if (aiData.items && Array.isArray(aiData.items)) {
            console.log('AI annotation successful:', { requestId, annotatedCount: aiData.items.length })
            
            // Merge AI annotations with existing data, keeping original URLs
            aiData.items.forEach((aiItem: ResourceCard, index: number) => {
              if (index < rankedResults.length) {
                rankedResults[index] = {
                  ...rankedResults[index], // Keep original data
                  ...aiItem, // Overlay AI improvements
                  url: rankedResults[index].url, // Ensure URL stays the same
                  source: rankedResults[index].source,
                  duration: rankedResults[index].duration // Keep video duration
                }
              }
            })
          }
        } catch (parseError) {
          console.warn('Failed to parse AI annotation, using original results:', { requestId, error: parseError })
        }
      } catch (aiError) {
        console.warn('AI annotation failed, using original results:', { requestId, error: aiError })
      }
    }

    // Prepare final response
    const response: ResourcesSearchResponse = {
      items: rankedResults,
      meta: {
        query: parsed.topic,
        generatedAt: new Date().toISOString(),
        preferences,
        preferOfficial
      }
    }

    console.log('Resources search completed successfully:', { 
      requestId, 
      finalCount: response.items.length,
      sources: response.items.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    })

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Resources search error:', { 
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