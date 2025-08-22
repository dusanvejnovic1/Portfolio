/**
 * YouTube Data API integration for video retrieval
 */

import { z } from 'zod'

// YouTube API response schemas
export const YouTubeVideoSchema = z.object({
  kind: z.string(),
  etag: z.string(),
  id: z.object({
    kind: z.string(),
    videoId: z.string()
  }),
  snippet: z.object({
    publishedAt: z.string(),
    channelId: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnails: z.record(z.object({
      url: z.string(),
      width: z.number(),
      height: z.number()
    })),
    channelTitle: z.string(),
    publishTime: z.string()
  })
})

export const YouTubeVideoDetailsSchema = z.object({
  kind: z.string(),
  etag: z.string(),
  id: z.string(),
  snippet: z.object({
    publishedAt: z.string(),
    channelId: z.string(),
    title: z.string(),
    description: z.string(),
    channelTitle: z.string(),
    categoryId: z.string().optional(),
    defaultLanguage: z.string().optional(),
    tags: z.array(z.string()).optional()
  }),
  contentDetails: z.object({
    duration: z.string(), // ISO 8601 format (PT4M13S)
    dimension: z.string(),
    definition: z.string(),
    caption: z.string()
  }).optional(),
  statistics: z.object({
    viewCount: z.string(),
    likeCount: z.string().optional(),
    commentCount: z.string().optional()
  }).optional()
})

export const YouTubeSearchResponseSchema = z.object({
  kind: z.string(),
  etag: z.string(),
  nextPageToken: z.string().optional(),
  regionCode: z.string().optional(),
  pageInfo: z.object({
    totalResults: z.number(),
    resultsPerPage: z.number()
  }),
  items: z.array(YouTubeVideoSchema)
})

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>
export type YouTubeVideoDetails = z.infer<typeof YouTubeVideoDetailsSchema>
export type YouTubeSearchResponse = z.infer<typeof YouTubeSearchResponseSchema>

/**
 * Search YouTube videos using YouTube Data API
 */
export async function searchYouTubeVideos(
  query: string,
  options: {
    maxResults?: number
    order?: 'date' | 'rating' | 'relevance' | 'title' | 'videoCount' | 'viewCount'
    publishedAfter?: string // RFC 3339 formatted date-time
    publishedBefore?: string
    videoDuration?: 'any' | 'long' | 'medium' | 'short'
    videoDefinition?: 'any' | 'high' | 'standard'
    regionCode?: string
  } = {}
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  
  if (!apiKey) {
    console.warn('YouTube API key not configured, returning empty results')
    return []
  }

  const {
    maxResults = 10,
    order = 'relevance',
    publishedAfter,
    publishedBefore,
    videoDuration = 'any',
    videoDefinition = 'any',
    regionCode = 'US'
  } = options

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: maxResults.toString(),
      order,
      videoDuration,
      videoDefinition,
      regionCode,
      key: apiKey
    })

    if (publishedAfter) {
      params.append('publishedAfter', publishedAfter)
    }

    if (publishedBefore) {
      params.append('publishedBefore', publishedBefore)
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    )

    if (!response.ok) {
      console.error('YouTube API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    const parsed = YouTubeSearchResponseSchema.parse(data)
    
    return parsed.items
  } catch (error) {
    console.error('YouTube search error:', error)
    return []
  }
}

/**
 * Get detailed video information including duration and statistics
 */
export async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  
  if (!apiKey || videoIds.length === 0) {
    return []
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoIds.join(','),
      key: apiKey
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`
    )

    if (!response.ok) {
      console.error('YouTube API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    
    if (data.items && Array.isArray(data.items)) {
      return data.items.map((item: unknown) => YouTubeVideoDetailsSchema.parse(item))
    }
    
    return []
  } catch (error) {
    console.error('YouTube video details error:', error)
    return []
  }
}

/**
 * Build IT-focused YouTube search queries
 */
export function buildITVideoQuery(
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner'
): string {
  let query = topic

  // Add level-specific terms
  switch (level) {
    case 'Beginner':
      query += ' tutorial beginner guide step by step'
      break
    case 'Intermediate':
      query += ' tutorial intermediate course walkthrough'
      break
    case 'Advanced':
      query += ' advanced course expert masterclass deep dive'
      break
  }

  return query
}

/**
 * Search for IT tutorial videos with optimized queries
 */
export async function searchITVideos(
  topic: string,
  options: {
    level?: 'Beginner' | 'Intermediate' | 'Advanced'
    includeRecent?: boolean
    preferLonger?: boolean
    maxResults?: number
  } = {}
): Promise<YouTubeVideo[]> {
  const {
    level = 'Beginner',
    includeRecent = true,
    preferLonger = false,
    maxResults = 10
  } = options

  const query = buildITVideoQuery(topic, level)
  
  const searchOptions = {
    maxResults,
    order: 'relevance' as const,
    videoDuration: preferLonger ? ('medium' as const) : ('any' as const),
    videoDefinition: 'any' as const
  }

  // Add date filter for recent content
  if (includeRecent) {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 6) // 6 months for tech content
    searchOptions.publishedAfter = oneMonthAgo.toISOString()
  }

  return searchYouTubeVideos(query, searchOptions)
}

/**
 * Parse YouTube video duration from ISO 8601 format to seconds
 */
export function parseYouTubeDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
}

/**
 * Format duration in seconds to readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * Filter and prioritize YouTube results for IT education
 */
export function prioritizeITVideos(
  videos: YouTubeVideo[],
  videoDetails: YouTubeVideoDetails[],
  topic: string
): Array<YouTubeVideo & { 
  priority: number
  reason: string
  duration?: number
  durationFormatted?: string
  viewCount?: number
}> {
  const educationalChannels = [
    // Tech education channels
    'freeCodeCamp.org',
    'Programming with Mosh',
    'Traversy Media',
    'The Net Ninja',
    'Academind',
    'Corey Schafer',
    'Tech With Tim',
    'Real Python',
    'AWS',
    'Microsoft Developer',
    'Google Developers',
    'Docker',
    'Kubernetes'
  ]

  const detailsMap = new Map(videoDetails.map(d => [d.id, d]))

  return videos.map(video => {
    let priority = 0
    let reason = 'General tutorial'
    
    const videoDetail = detailsMap.get(video.id.videoId)
    const channelTitle = video.snippet.channelTitle

    // Highest priority for known educational channels
    if (educationalChannels.some(channel => 
      channelTitle.toLowerCase().includes(channel.toLowerCase())
    )) {
      priority += 10
      reason = 'Educational channel'
    }

    // Boost results that match topic keywords closely
    const topicKeywords = topic.toLowerCase().split(' ')
    const titleMatch = topicKeywords.filter(keyword => 
      video.snippet.title.toLowerCase().includes(keyword)
    ).length
    const descMatch = topicKeywords.filter(keyword => 
      video.snippet.description.toLowerCase().includes(keyword)
    ).length
    
    priority += titleMatch * 3 + descMatch

    // Prefer moderate-length videos (5-30 minutes)
    let duration = 0
    let durationFormatted = ''
    
    if (videoDetail?.contentDetails?.duration) {
      duration = parseYouTubeDuration(videoDetail.contentDetails.duration)
      durationFormatted = formatDuration(duration)
      
      if (duration >= 300 && duration <= 1800) { // 5-30 minutes
        priority += 3
        reason += ', Good length'
      } else if (duration < 120) { // Too short
        priority -= 2
      } else if (duration > 3600) { // Too long
        priority -= 1
      }
    }

    // Boost popular videos (high view count)
    let viewCount = 0
    if (videoDetail?.statistics?.viewCount) {
      viewCount = parseInt(videoDetail.statistics.viewCount)
      if (viewCount > 100000) {
        priority += 2
        reason += ', Popular'
      }
    }

    // Boost recent videos
    const publishDate = new Date(video.snippet.publishedAt)
    const monthsAgo = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsAgo < 6) {
      priority += 2
      reason += ', Recent'
    } else if (monthsAgo > 24) {
      priority -= 1
      reason += ', Older content'
    }

    // Penalize very short descriptions (likely low-quality)
    if (video.snippet.description.length < 50) {
      priority -= 1
    }

    return {
      ...video,
      priority,
      reason,
      duration: duration || undefined,
      durationFormatted: durationFormatted || undefined,
      viewCount: viewCount || undefined
    }
  }).sort((a, b) => b.priority - a.priority)
}

/**
 * Get YouTube video URL from video ID
 */
export function getVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Get YouTube thumbnail URL
 */
export function getThumbnailUrl(video: YouTubeVideo, quality: 'default' | 'medium' | 'high' = 'medium'): string {
  return video.snippet.thumbnails[quality]?.url || 
         video.snippet.thumbnails.default?.url || 
         ''
}