/**
 * LLM wrapper to select between DEFAULT_MODEL and QUALITY_MODEL
 */

import { openai, isGpt5, DEFAULT_MODEL, QUALITY_MODEL, VISION_MODEL } from './openai'

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

  // Handle GPT-5 models using Responses API
  if (isGpt5(selectedModel)) {
    if (stream) {
      throw new Error('GPT-5 streaming not supported in this wrapper. Use openai().responses.stream() directly.')
    }
    
    // Try Responses API first, then fallback to Chat Completions
    try {
      // Check if responses API exists
      if (!client.responses || typeof client.responses.create !== 'function') {
        throw new Error('Responses API not available in current SDK version')
      }
      
      // Convert messages to a single input string for GPT-5 Responses API
      let combinedInput = ''
      messages.forEach(msg => {
        if (msg.role === 'system') {
          combinedInput += `${msg.content}\n\n`
        } else if (msg.role === 'user') {
          combinedInput += `User: ${msg.content}\n`
        } else if (msg.role === 'assistant') {
          combinedInput += `Assistant: ${msg.content}\n`
        }
      })
      
      // Use Responses API for GPT-5
      const response = await client.responses.create({
        model: selectedModel,
        input: combinedInput.trim(),
        stream: false
      })
      
      // Extract text content from GPT-5 response
      let responseText = ''
      if (response.output && Array.isArray(response.output)) {
        for (const item of response.output) {
          if (item.type === 'message' && item.content) {
            for (const content of item.content) {
              if (content.type === 'output_text' && content.text) {
                responseText += content.text
              }
            }
          }
        }
      }
      
      // Return in Chat Completions API format for compatibility
      return {
        choices: [{
          message: {
            content: responseText
          }
        }]
      }
    } catch (error) {
      console.log(`Responses API failed for ${selectedModel}, falling back to Chat Completions API:`, error)
      
      // Fallback to Chat Completions API
      return client.chat.completions.create({
        model: selectedModel,
        messages,
        ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
        temperature,
        stream
      })
    }
  }

  // Use Chat Completions API for GPT-4 family
  return client.chat.completions.create({
    model: selectedModel,
    messages,
    ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
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