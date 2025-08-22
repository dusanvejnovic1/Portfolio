/**
 * Bing Web Search API integration for retrieval
 */

import { z } from 'zod'

// Bing Search API response schemas
export const BingWebPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  displayUrl: z.string(),
  snippet: z.string(),
  dateLastCrawled: z.string().optional(),
  language: z.string().optional()
})

export const BingSearchResponseSchema = z.object({
  webPages: z.object({
    value: z.array(BingWebPageSchema)
  }).optional()
})

export type BingWebPage = z.infer<typeof BingWebPageSchema>
export type BingSearchResponse = z.infer<typeof BingSearchResponseSchema>

/**
 * Search the web using Bing Search API
 */
export async function searchWeb(
  query: string,
  options: {
    count?: number
    offset?: number
    market?: string
    safeSearch?: 'Off' | 'Moderate' | 'Strict'
    freshness?: 'Day' | 'Week' | 'Month'
  } = {}
): Promise<BingWebPage[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY
  
  if (!apiKey) {
    console.warn('Bing Search API key not configured, returning empty results')
    return []
  }

  const {
    count = 10,
    offset = 0,
    market = 'en-US',
    safeSearch = 'Moderate',
    freshness
  } = options

  try {
    const params = new URLSearchParams({
      q: query,
      count: count.toString(),
      offset: offset.toString(),
      mkt: market,
      safeSearch
    })

    if (freshness) {
      params.append('freshness', freshness)
    }

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?${params}`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('Bing Search API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    const parsed = BingSearchResponseSchema.parse(data)
    
    return parsed.webPages?.value || []
  } catch (error) {
    console.error('Bing Search error:', error)
    return []
  }
}

/**
 * Build IT-focused search queries with preference for official sources
 */
export function buildITQuery(
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner',
  preferOfficial: boolean = true
): string {
  let query = topic

  // Add level-specific terms
  switch (level) {
    case 'Beginner':
      query += ' tutorial guide getting started basics'
      break
    case 'Intermediate':
      query += ' best practices implementation advanced guide'
      break
    case 'Advanced':
      query += ' expert deep dive advanced techniques optimization'
      break
  }

  // Prefer official documentation and reputable sources
  if (preferOfficial) {
    const officialSites = [
      'site:docs.microsoft.com',
      'site:developer.mozilla.org',
      'site:aws.amazon.com',
      'site:cloud.google.com',
      'site:kubernetes.io',
      'site:docker.com',
      'site:github.com',
      'site:stackoverflow.com'
    ]
    
    // Add OR operator for official sites
    query += ` (${officialSites.join(' OR ')})`
  }

  return query
}

/**
 * Search for IT resources with optimized queries
 */
export async function searchITResources(
  topic: string,
  options: {
    level?: 'Beginner' | 'Intermediate' | 'Advanced'
    preferOfficial?: boolean
    includeRecent?: boolean
    count?: number
  } = {}
): Promise<BingWebPage[]> {
  const {
    level = 'Beginner',
    preferOfficial = true,
    includeRecent = true,
    count = 10
  } = options

  const query = buildITQuery(topic, level, preferOfficial)
  
  const searchOptions = {
    count,
    safeSearch: 'Moderate' as const,
    ...(includeRecent && { freshness: 'Month' as const })
  }

  return searchWeb(query, searchOptions)
}

/**
 * Filter and prioritize results for IT education
 */
export function prioritizeITResults(
  results: BingWebPage[],
  topic: string
): Array<BingWebPage & { priority: number; reason: string }> {
  const officialDomains = [
    'docs.microsoft.com',
    'developer.mozilla.org',
    'aws.amazon.com',
    'cloud.google.com',
    'kubernetes.io',
    'docker.com',
    'github.com',
    'redis.io',
    'mongodb.com',
    'postgresql.org',
    'python.org',
    'nodejs.org',
    'reactjs.org',
    'angular.io',
    'vuejs.org'
  ]

  const reputableDomains = [
    'stackoverflow.com',
    'medium.com',
    'dev.to',
    'hackernoon.com',
    'freecodecamp.org',
    'codecademy.com',
    'pluralsight.com',
    'udemy.com',
    'coursera.org',
    'edx.org'
  ]

  return results.map(result => {
    let priority = 0
    let reason = 'General result'

    const domain = new URL(result.url).hostname

    // Highest priority for official documentation
    if (officialDomains.some(official => domain.includes(official))) {
      priority += 10
      reason = 'Official documentation'
    }

    // Medium priority for reputable educational sites
    else if (reputableDomains.some(reputable => domain.includes(reputable))) {
      priority += 5
      reason = 'Reputable educational source'
    }

    // Boost results that match topic keywords closely
    const topicKeywords = topic.toLowerCase().split(' ')
    const nameMatch = topicKeywords.filter(keyword => 
      result.name.toLowerCase().includes(keyword)
    ).length
    const snippetMatch = topicKeywords.filter(keyword => 
      result.snippet.toLowerCase().includes(keyword)
    ).length
    
    priority += nameMatch * 2 + snippetMatch

    // Boost recent content
    if (result.dateLastCrawled) {
      const crawlDate = new Date(result.dateLastCrawled)
      const monthsAgo = (Date.now() - crawlDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsAgo < 6) {
        priority += 2
        reason += ', Recent content'
      }
    }

    // Penalize very short snippets (likely low-quality)
    if (result.snippet.length < 50) {
      priority -= 2
    }

    return {
      ...result,
      priority,
      reason
    }
  }).sort((a, b) => b.priority - a.priority)
}

/**
 * Extract key information from web search results
 */
export function extractWebMetadata(result: BingWebPage): {
  publisher: string
  isOfficial: boolean
  estimatedFreshness: 'recent' | 'moderate' | 'old' | 'unknown'
} {
  const domain = new URL(result.url).hostname
  const publisher = domain.replace('www.', '').replace('.com', '').replace('.org', '').replace('.io', '')

  const officialDomains = [
    'docs.microsoft.com',
    'developer.mozilla.org',
    'aws.amazon.com',
    'cloud.google.com',
    'kubernetes.io',
    'docker.com',
    'python.org',
    'nodejs.org'
  ]

  const isOfficial = officialDomains.some(official => domain.includes(official))

  let estimatedFreshness: 'recent' | 'moderate' | 'old' | 'unknown' = 'unknown'
  
  if (result.dateLastCrawled) {
    const crawlDate = new Date(result.dateLastCrawled)
    const monthsAgo = (Date.now() - crawlDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsAgo < 3) {
      estimatedFreshness = 'recent'
    } else if (monthsAgo < 12) {
      estimatedFreshness = 'moderate'
    } else {
      estimatedFreshness = 'old'
    }
  }

  return {
    publisher,
    isOfficial,
    estimatedFreshness
  }
}