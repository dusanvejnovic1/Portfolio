import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export const openai = getOpenAIClient

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
export const QUALITY_MODEL = process.env.QUALITY_MODEL || 'gpt-4o'

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function moderateContent(input: string) {
  const client = getOpenAIClient()
  const maxAttempts = 3
  const delays = [250, 500, 1000] // Exponential backoff: 250ms, 500ms, 1000ms
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const moderation = await client.moderations.create({
        input,
        model: 'omni-moderation-latest',
      })
      
      return moderation.results[0]
    } catch (error) {
      console.error(`Moderation error (attempt ${attempt + 1}/${maxAttempts}):`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: attempt + 1,
      })
      
      // If this is the last attempt, return safe fallback
      if (attempt === maxAttempts - 1) {
        console.error('All moderation attempts failed, returning safe fallback')
        // Return false flagged to avoid false positives on transient failures
        // We still have rate limiting and output moderation via system prompt
        return { flagged: false, categories: {}, category_scores: {}, error: 'moderation_failed' }
      }
      
      // Wait before retrying
      await delay(delays[attempt])
    }
  }
  
  // This should never be reached, but TypeScript needs it
  return { flagged: false, categories: {}, category_scores: {}, error: 'moderation_failed' }
}