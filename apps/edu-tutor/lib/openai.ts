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
  
  const model = process.env.DEFAULT_MODEL || 'gpt-5-mini'
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

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-5-mini'
export const QUALITY_MODEL = process.env.QUALITY_MODEL || 'gpt-5'
export const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o'

// Helper to resolve the effective model for a request
export function resolveModel(requestedModel?: string): string {
  // Priority: explicit request model -> DEFAULT_MODEL -> safe fallback
  const model = requestedModel || DEFAULT_MODEL
  
  // Validate that the model string is non-empty
  if (!model || typeof model !== 'string' || !model.trim()) {
    console.warn('Invalid model provided, falling back to DEFAULT_MODEL:', { requestedModel, DEFAULT_MODEL })
    return DEFAULT_MODEL
  }
  
  return model.trim()
}

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
export async function testOpenAIConnection(testModel?: string) {
  const startTime = Date.now()
  const model = resolveModel(testModel)
  
  console.log('Testing OpenAI connection with model:', model, {
    requested: testModel,
    resolved: model,
    hasApiKey: !!process.env.OPENAI_API_KEY
  })
  
  try {
    const client = getOpenAIClient()
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "pong"' }],
      max_tokens: 5,
      temperature: 0
    })
    
    const latency = Date.now() - startTime
    const response = completion.choices[0]?.message?.content || ''
    
    return {
      ok: true,
      model,
      provider_latency_ms: latency,
      response_received: !!response
    }
  } catch (error) {
    const latency = Date.now() - startTime
    console.error('OpenAI diagnostic failed:', error)
    
    // Check if it's a model-related error and provide better error messages
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let errorCode = 'provider_error'
    
    if (error instanceof Error) {
      if (error.message.includes('model') || error.message.includes('Model')) {
        errorCode = 'config_error'
        errorMessage = `Model configuration error for '${model}'. Please verify the model is available for your API key or check for typos.`
      } else if (error.message.includes('API key')) {
        errorCode = 'config_error'
        errorMessage = 'Service configuration error. Please contact support.'
      }
    }
    
    return {
      ok: false,
      model,
      provider_latency_ms: latency,
      error: errorMessage,
      code: errorCode
    }
  }
}
