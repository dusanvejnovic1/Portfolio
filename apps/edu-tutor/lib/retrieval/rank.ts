/**
 * Ranking and deduplication utilities for search results
 */

import { BingWebPage } from './webSearch'
import { YouTubeVideo } from './youtube'
import { ResourceCard } from '../../types/modes'

export interface RankedResult {
  score: number
  reason: string
  source: 'web' | 'youtube'
  originalResult: BingWebPage | YouTubeVideo
}

/**
 * Deduplicate results by URL and title similarity
 */
export function deduplicateResults(results: ResourceCard[]): ResourceCard[] {
  const seen = new Set<string>()
  const deduplicated: ResourceCard[] = []

  for (const result of results) {
    // Create a key based on URL and normalized title
    const normalizedTitle = result.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    const key = `${new URL(result.url).hostname}::${normalizedTitle}`
    
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(result)
    }
  }

  return deduplicated
}

/**
 * Calculate similarity between two strings using Jaccard coefficient
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/))
  const words2 = new Set(str2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return union.size === 0 ? 0 : intersection.size / union.size
}

/**
 * Remove similar results (fuzzy deduplication)
 */
export function removeSimilarResults(
  results: ResourceCard[], 
  threshold: number = 0.7
): ResourceCard[] {
  const filtered: ResourceCard[] = []
  
  for (const result of results) {
    const isSimilar = filtered.some(existing => 
      calculateSimilarity(result.title, existing.title) > threshold ||
      calculateSimilarity(result.url, existing.url) > threshold
    )
    
    if (!isSimilar) {
      filtered.push(result)
    }
  }
  
  return filtered
}

/**
 * Rank results by relevance to IT learning topic
 */
export function rankByRelevance(
  results: ResourceCard[],
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner'
): ResourceCard[] {
  const topicKeywords = topic.toLowerCase().split(/\s+/)
  const levelKeywords = getLevelKeywords(level)
  
  const scored = results.map(result => {
    let score = result.relevanceScore
    
    // Boost exact topic matches in title
    const titleWords = result.title.toLowerCase().split(/\s+/)
    const titleMatches = topicKeywords.filter(keyword => 
      titleWords.some(word => word.includes(keyword))
    ).length
    score += titleMatches * 10
    
    // Boost level-appropriate content
    const hasLevelKeywords = levelKeywords.some(keyword =>
      result.title.toLowerCase().includes(keyword) ||
      result.keyTakeaways.some(takeaway => takeaway.toLowerCase().includes(keyword))
    )
    if (hasLevelKeywords) {
      score += 5
    }
    
    // Boost official sources
    if (result.isOfficial) {
      score += 15
    }
    
    // Boost recent content
    if (result.lastUpdated) {
      const monthsAgo = (Date.now() - new Date(result.lastUpdated).getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsAgo < 6) {
        score += 10
      } else if (monthsAgo < 12) {
        score += 5
      }
    }
    
    // Penalize very short content
    if (result.keyTakeaways.length < 2) {
      score -= 5
    }
    
    return { ...result, relevanceScore: Math.max(0, Math.min(100, score)) }
  })
  
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Get keywords associated with learning levels
 */
function getLevelKeywords(level: 'Beginner' | 'Intermediate' | 'Advanced'): string[] {
  switch (level) {
    case 'Beginner':
      return ['beginner', 'introduction', 'basics', 'getting started', 'tutorial', 'guide', 'fundamentals', 'overview']
    case 'Intermediate':
      return ['intermediate', 'practical', 'implementation', 'examples', 'best practices', 'walkthrough', 'course']
    case 'Advanced':
      return ['advanced', 'expert', 'deep dive', 'optimization', 'performance', 'architecture', 'patterns', 'enterprise']
  }
}

/**
 * Apply content quality filters
 */
export function filterByQuality(results: ResourceCard[]): ResourceCard[] {
  return results.filter(result => {
    // Filter out results with very low relevance scores
    if (result.relevanceScore < 20) {
      return false
    }
    
    // Filter out results with suspicious URLs
    try {
      const url = new URL(result.url)
      const suspiciousDomains = ['spam', 'malware', 'phishing', 'adult']
      if (suspiciousDomains.some(domain => url.hostname.includes(domain))) {
        return false
      }
    } catch {
      return false // Invalid URL
    }
    
    // Filter out results with very short titles
    if (result.title.length < 10) {
      return false
    }
    
    // Filter out results with no meaningful content
    if (result.keyTakeaways.length === 0) {
      return false
    }
    
    return true
  })
}

/**
 * Balance result types (web vs video)
 */
export function balanceResultTypes(
  results: ResourceCard[],
  preferences?: {
    video?: boolean
    docs?: boolean
    course?: boolean
  }
): ResourceCard[] {
  if (!preferences) {
    // Default balance: 60% web, 40% video
    const webResults = results.filter(r => r.source === 'web')
    const videoResults = results.filter(r => r.source === 'youtube')
    
    const maxWeb = Math.ceil(results.length * 0.6)
    const maxVideo = Math.floor(results.length * 0.4)
    
    return [
      ...webResults.slice(0, maxWeb),
      ...videoResults.slice(0, maxVideo)
    ].sort((a, b) => b.relevanceScore - a.relevanceScore)
  }
  
  const filtered: ResourceCard[] = []
  
  if (preferences.video) {
    filtered.push(...results.filter(r => r.source === 'youtube'))
  }
  
  if (preferences.docs) {
    filtered.push(...results.filter(r => 
      r.source === 'web' && 
      (r.isOfficial || r.badges?.includes('official'))
    ))
  }
  
  if (preferences.course) {
    filtered.push(...results.filter(r => 
      r.title.toLowerCase().includes('course') ||
      r.title.toLowerCase().includes('tutorial series') ||
      r.badges?.includes('comprehensive')
    ))
  }
  
  return filtered
}

/**
 * Diversify results to avoid echo chambers
 */
export function diversifyResults(results: ResourceCard[]): ResourceCard[] {
  const diversified: ResourceCard[] = []
  const publisherCounts = new Map<string, number>()
  
  for (const result of results) {
    const publisher = result.publisher || 'unknown'
    const currentCount = publisherCounts.get(publisher) || 0
    
    // Limit results per publisher (max 3)
    if (currentCount < 3) {
      diversified.push(result)
      publisherCounts.set(publisher, currentCount + 1)
    }
  }
  
  return diversified
}

/**
 * Main ranking pipeline
 */
export function rankAndFilterResults(
  results: ResourceCard[],
  topic: string,
  options: {
    level?: 'Beginner' | 'Intermediate' | 'Advanced'
    preferences?: {
      video?: boolean
      docs?: boolean
      course?: boolean
    }
    maxResults?: number
    diversify?: boolean
  } = {}
): ResourceCard[] {
  const {
    level = 'Beginner',
    preferences,
    maxResults = 20,
    diversify = true
  } = options
  
  let processed = results
  
  // Step 1: Remove duplicates
  processed = deduplicateResults(processed)
  processed = removeSimilarResults(processed)
  
  // Step 2: Apply quality filters
  processed = filterByQuality(processed)
  
  // Step 3: Rank by relevance
  processed = rankByRelevance(processed, topic, level)
  
  // Step 4: Balance result types based on preferences
  processed = balanceResultTypes(processed, preferences)
  
  // Step 5: Diversify sources
  if (diversify) {
    processed = diversifyResults(processed)
  }
  
  // Step 6: Limit results
  processed = processed.slice(0, maxResults)
  
  return processed
}

/**
 * Generate explanation for ranking decisions
 */
export function explainRanking(result: ResourceCard, topic: string): string {
  const explanations: string[] = []
  
  if (result.isOfficial) {
    explanations.push('Official documentation')
  }
  
  if (result.relevanceScore > 80) {
    explanations.push('High relevance match')
  }
  
  if (result.badges?.includes('recent')) {
    explanations.push('Recently updated')
  }
  
  if (result.source === 'youtube' && result.duration) {
    explanations.push('Video tutorial')
  }
  
  const topicWords = topic.toLowerCase().split(/\s+/)
  const titleMatches = topicWords.filter(word => 
    result.title.toLowerCase().includes(word)
  ).length
  
  if (titleMatches > 0) {
    explanations.push(`${titleMatches} topic match${titleMatches > 1 ? 'es' : ''} in title`)
  }
  
  return explanations.length > 0 
    ? explanations.join(', ')
    : 'General relevance'
}