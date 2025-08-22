/**
 * Search provider interfaces and implementations
 * Supports Google Custom Search Engine (CSE) integration
 */

import { z } from 'zod'

// Common search result interface
export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

// Base search provider interface
export interface SearchProvider {
  name: string
  search(query: string, options?: { count?: number }): Promise<SearchResult[]>
  isConfigured(): boolean
}

// Google CSE API response schemas
export const GoogleCSEItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string().optional(),
  displayLink: z.string().optional()
})

export const GoogleCSEResponseSchema = z.object({
  items: z.array(GoogleCSEItemSchema).optional(),
  searchInformation: z.object({
    totalResults: z.string().optional()
  }).optional()
})

export type GoogleCSEItem = z.infer<typeof GoogleCSEItemSchema>
export type GoogleCSEResponse = z.infer<typeof GoogleCSEResponseSchema>

/**
 * Google Custom Search Engine provider
 */
export class GoogleCSEProvider implements SearchProvider {
  name = 'google_cse'
  
  private apiKey: string | undefined
  private cx: string | undefined
  
  constructor() {
    this.apiKey = process.env.GOOGLE_CSE_API_KEY
    this.cx = process.env.GOOGLE_CSE_CX
  }
  
  isConfigured(): boolean {
    return !!(this.apiKey && this.cx)
  }
  
  async search(query: string, options: { count?: number } = {}): Promise<SearchResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Google CSE provider is not properly configured')
    }
    
    const { count = 10 } = options
    
    try {
      const params = new URLSearchParams({
        key: this.apiKey!,
        cx: this.cx!,
        q: query,
        num: Math.min(count, 10).toString() // Google CSE allows max 10 results per request
      })
      
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google CSE API error:', response.status, response.statusText, errorText)
        throw new Error(`Google CSE API error: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      const parsed = GoogleCSEResponseSchema.parse(data)
      
      return (parsed.items || []).map((item): SearchResult => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        source: 'google_cse'
      }))
    } catch (error) {
      console.error('Google CSE search error:', error)
      throw error
    }
  }
  
  /**
   * Test Google CSE connectivity with a simple query
   */
  async testConnection(): Promise<{ ok: boolean; error?: string; latency?: number }> {
    const startTime = Date.now()
    
    try {
      await this.search('test', { count: 1 })
      const latency = Date.now() - startTime
      
      return {
        ok: true,
        latency
      }
    } catch (error) {
      const latency = Date.now() - startTime
      
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        latency
      }
    }
  }
}

/**
 * Runtime resolver for search providers
 * Returns available provider based on environment configuration
 */
export function resolveSearchProvider(): SearchProvider | null {
  const googleCSE = new GoogleCSEProvider()
  
  if (googleCSE.isConfigured()) {
    return googleCSE
  }
  
  return null
}