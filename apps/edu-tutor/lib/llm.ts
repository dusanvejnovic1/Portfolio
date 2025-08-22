/**
 * LLM wrapper to select between DEFAULT_MODEL and QUALITY_MODEL
 */

import { openai } from './openai'

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4o-mini'
export const QUALITY_MODEL = process.env.QUALITY_MODEL || 'gpt-4o'
export const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o'

/**
 * Get the appropriate model for a given task
 */
export function getModelForTask(task: 'default' | 'quality' | 'vision' = 'default'): string {
  switch (task) {
    case 'quality':
      return QUALITY_MODEL
    case 'vision':
      return VISION_MODEL
    case 'default':
    default:
      return DEFAULT_MODEL
  }
}

/**
 * Create a chat completion with the specified model
 */
export async function createChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: 'default' | 'quality' | 'vision'
    maxTokens?: number
    temperature?: number
    stream?: boolean
  } = {}
) {
  const {
    model = 'default',
    maxTokens = 800,
    temperature = 0.7,
    stream = false
  } = options

  const selectedModel = getModelForTask(model)
  const client = openai() // Call the function to get the client

  return client.chat.completions.create({
    model: selectedModel,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream
  })
}

/**
 * Create a streaming chat completion with the specified model
 */
export async function createStreamingChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: 'default' | 'quality' | 'vision'
    maxTokens?: number
    temperature?: number
  } = {}
) {
  return createChatCompletion(messages, { ...options, stream: true })
}

/**
 * Generate a single response (non-streaming)
 */
export async function generateResponse(
  prompt: string,
  systemPrompt?: string,
  options: {
    model?: 'default' | 'quality' | 'vision'
    maxTokens?: number
    temperature?: number
  } = {}
): Promise<string> {
  const messages = []
  
  if (systemPrompt) {
    messages.push({ role: 'system' as const, content: systemPrompt })
  }
  
  messages.push({ role: 'user' as const, content: prompt })

  const completion = await createChatCompletion(messages, { ...options, stream: false })
  
  // Type assertion since we know stream is false
  const chatCompletion = completion as { choices: Array<{ message: { content: string } }> }
  return chatCompletion.choices[0]?.message?.content || ''
}

/**
 * Check if a model supports streaming
 */
export function supportsStreaming(model: string): boolean {
  // Most OpenAI models support streaming
  return !model.startsWith('gpt-3.5-turbo-instruct')
}

/**
 * Estimate token count for a message (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

/**
 * Validate that required environment variables are set
 */
export function validateLLMConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required')
  }
  
  if (!DEFAULT_MODEL) {
    errors.push('DEFAULT_MODEL is not configured')
  }
  
  if (!QUALITY_MODEL) {
    errors.push('QUALITY_MODEL is not configured')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}