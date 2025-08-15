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

export async function moderateContent(input: string) {
  try {
    const client = getOpenAIClient()
    const moderation = await client.moderations.create({
      input,
      model: 'omni-moderation-latest',
    })
    
    return moderation.results[0]
  } catch (error) {
    console.error('Moderation error:', error)
    // If moderation fails, err on the side of caution
    return { flagged: true, categories: {}, category_scores: {} }
  }
}