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
export const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o'

// Helper to detect if a model is GPT-5
export function isGpt5(model: string): boolean {
  return /^gpt-5/.test(model)
}

// Helper to resolve the effective model for a request
export function resolveModel(requestedModel?: string): string {
  // Priority: explicit request model -> DEFAULT_MODEL -> safe fallback
  const model = requestedModel || DEFAULT_MODEL || 'gpt-4o-mini'
  
  // Validate that the model string is non-empty
  if (!model || typeof model !== 'string' || !model.trim()) {
    console.warn('Invalid model provided, falling back to safe default:', { requestedModel, DEFAULT_MODEL })
    return 'gpt-4o-mini'
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
  const endpoint = isGpt5(model) ? 'responses' : 'chat.completions'
  
  console.log('Testing OpenAI connection with model:', model, {
    requested: testModel,
    resolved: model,
    endpoint,
    hasApiKey: !!process.env.OPENAI_API_KEY
  })
  
  try {
    const client = getOpenAIClient()
    
    if (isGpt5(model)) {
      // Use Responses API for GPT-5 (fallback to Chat Completions for now)
      // Note: This is a placeholder. The actual Responses API interface 
      // may differ when GPT-5 is available.
      console.warn(`GPT-5 detected (${model}) but using Chat Completions API as fallback. Responses API implementation pending.`)
      
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say "pong"' }],
        max_tokens: 5,
        temperature: 0
      })
      
      const latency = Date.now() - startTime
      const responseText = completion.choices[0]?.message?.content || ''
      
      return {
        ok: true,
        model,
        endpoint: `${endpoint} (fallback to chat.completions)`,
        provider_latency_ms: latency,
        response_received: !!responseText
      }
    } else {
      // Use Chat Completions API for GPT-4 family
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say "pong"' }],
        max_tokens: 5,
        temperature: 0
      })
      
      const latency = Date.now() - startTime
      const responseText = completion.choices[0]?.message?.content || ''
      
      return {
        ok: true,
        model,
        endpoint,
        provider_latency_ms: latency,
        response_received: !!responseText
      }
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
      endpoint,
      provider_latency_ms: latency,
      error: errorMessage,
      code: errorCode
    }
  }
}
