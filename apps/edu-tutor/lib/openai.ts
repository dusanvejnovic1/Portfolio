import OpenAI from 'openai'

// Extended type for moderation results that include service error info
interface ModerationResult extends OpenAI.Moderation {
  service_error?: boolean
}

let openaiClient: OpenAI | null = null

// Environment validation function
export function validateEnvironment(): { ok: boolean; error?: string } {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY environment variable is required' }
  }
  
  const model = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
  if (!model) {
    return { ok: false, error: 'DEFAULT_MODEL is not configured' }
  }
  
  return { ok: true }
}

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

export async function moderateContent(input: string): Promise<ModerationResult> {
  try {
    const client = getOpenAIClient()
    const moderation = await client.moderations.create({
      input,
      model: 'omni-moderation-latest',
    })
    
    return moderation.results[0] as ModerationResult
  } catch (error) {
    console.error('Moderation service error:', error)
    // If moderation fails due to technical issues, treat as neutral
    // Return a minimal structure with service_error flag
    return {
      flagged: false,
      service_error: true
    } as ModerationResult
  }
}

// Diagnostic function to test OpenAI connectivity
export async function testOpenAIConnection() {
  const startTime = Date.now()
  
  try {
    const client = getOpenAIClient()
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'Say "pong"' }],
      max_tokens: 5,
      temperature: 0
    })
    
    const latency = Date.now() - startTime
    const response = completion.choices[0]?.message?.content || ''
    
    return {
      ok: true,
      model: DEFAULT_MODEL,
      provider_latency_ms: latency,
      response_received: !!response
    }
  } catch (error) {
    const latency = Date.now() - startTime
    console.error('OpenAI diagnostic failed:', error)
    
    return {
      ok: false,
      model: DEFAULT_MODEL,
      provider_latency_ms: latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}