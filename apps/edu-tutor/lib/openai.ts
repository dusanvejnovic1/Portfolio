/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from 'openai'

// Lazily initialize the OpenAI client to avoid constructing it at module import time.
// This allows tests to mock this module without requiring OPENAI_API_KEY to be set.
let _realClient: any = null
function createRealClient() {
  if (_realClient) return _realClient
  // In test environments we avoid constructing the real OpenAI client so tests can mock the module
  if (process.env.VITEST) return null

  if (!process.env.OPENAI_API_KEY) {
    // Do not construct the real client; return a proxy that will throw when used.
    return null
  }
  _realClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _realClient
}

const missingKeyError = new Error("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).")

export const client: any = new Proxy({}, {
  get(_, prop) {
    const c = createRealClient()
    if (!c) {
      // Defer throwing until a method/property is actually accessed so tests can mock the module
      throw missingKeyError
    }
    const val = c[prop as keyof typeof c]
    if (typeof val === 'function') return val.bind(c)
    return val
  },
  // allow function-call style in case code does `client()` (none should)
  apply(_target, _thisArg, _args) {
    const c = createRealClient()
    if (!c) throw missingKeyError
    return (c as any).apply(_thisArg, _args)
  }
})

// Backwards-compatible helper: many files and tests previously used openai() to get the client.
export function openai() {
  return client as any
}

// Extended type for moderation results that include service error info
interface ModerationResult {
  flagged?: boolean
  service_error?: boolean
  [k: string]: any
}

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-5-nano'
export const QUALITY_MODEL = process.env.QUALITY_MODEL || 'gpt-4o'
export const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o'

// Helper to detect if a model is GPT-5
export function isGpt5(model: string): boolean {
  return /^gpt-5/.test(model)
}

// Helper to resolve the effective model for a request
export function resolveModel(requestedModel?: string): string {
  const model = (requestedModel || DEFAULT_MODEL || 'gpt-5-nano').toString().trim()
  if (!model) return 'gpt-5-nano'
  return model
}

export function resolveModelWithFallback(requestedModel?: string): string {
  return resolveModel(requestedModel)
}

export async function moderateContent(input: string): Promise<ModerationResult> {
  try {
    const moderation = await (client as any).moderations.create({ input, model: 'omni-moderation-latest' })
    return moderation.results?.[0] ?? { flagged: false }
  } catch (error) {
    console.error('Moderation service error:', error)
    return { flagged: false, service_error: true }
  }
}

// Simple environment validator used by routes to provide clearer errors
export function validateEnvironment() {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY not configured' }
  }
  return { ok: true }
}

export async function testOpenAIConnection(testModel?: string) {
  const startTime = Date.now()
  const model = resolveModel(testModel)
  const endpoint = isGpt5(model) ? 'responses' : 'chat.completions'

  try {
    if (isGpt5(model)) {
      const response = await (client as any).responses.create({ model, input: 'Say "pong"', stream: false })
      const latency = Date.now() - startTime
      let responseText = ''
      if (response.output && Array.isArray(response.output)) {
        for (const item of response.output) {
          if (item.type === 'message' && item.content) {
            for (const content of item.content) {
              if (content.type === 'output_text' && content.text) responseText += content.text
            }
          }
        }
      }
      return { ok: true, model, endpoint, provider_latency_ms: latency, response_received: !!responseText }
    }

  const completion = await (client as any).chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "pong"' }],
      max_tokens: 5,
      temperature: 0,
    })

    const latency = Date.now() - startTime
    const responseText = completion.choices?.[0]?.message?.content || ''
    return { ok: true, model, endpoint, provider_latency_ms: latency, response_received: !!responseText }
  } catch (error) {
    const latency = Date.now() - startTime
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let errorCode = 'provider_error'

    if (error instanceof Error) {
      if (error.message.includes('model')) {
        errorCode = 'config_error'
        errorMessage = `Model configuration error for '${model}'. Please verify the model is available for your API key or check for typos.`
      } else if (error.message.includes('API key')) {
        errorCode = 'config_error'
        errorMessage = 'Service configuration error. Please contact support.'
      }
    }

    return { ok: false, model, endpoint, provider_latency_ms: latency, error: errorMessage, code: errorCode }
  }
}
