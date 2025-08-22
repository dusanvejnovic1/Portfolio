/**
 * Moderation helpers using existing /api/moderate logic
 */

import { z } from 'zod'

export const ModerationResponseSchema = z.object({
  flagged: z.boolean(),
  categories: z.record(z.boolean()),
  category_scores: z.record(z.number())
})

export type ModerationResponse = z.infer<typeof ModerationResponseSchema>

/**
 * Moderate content using the existing moderation endpoint
 */
export async function moderateContent(
  input: string,
  baseUrl?: string
): Promise<{ flagged: boolean; reason?: string }> {
  try {
    const url = baseUrl ? `${baseUrl}/api/moderate` : '/api/moderate'
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input })
    })

    if (!response.ok) {
      console.warn('Moderation service unavailable, allowing content')
      return { flagged: false }
    }

    const data = await response.json()
    const parsed = ModerationResponseSchema.parse(data)

    if (parsed.flagged) {
      // Find the primary reason for flagging
      const flaggedCategories = Object.entries(parsed.categories)
        .filter(([, flagged]) => flagged)
        .map(([category]) => category)

      const reason = flaggedCategories.length > 0 
        ? `Content flagged for: ${flaggedCategories.join(', ')}`
        : 'Content flagged by moderation system'

      return { flagged: true, reason }
    }

    return { flagged: false }
  } catch (error) {
    console.warn('Moderation error, allowing content:', error)
    return { flagged: false }
  }
}

/**
 * Pre-moderation: Check content before processing
 */
export async function preModerate(
  input: string,
  options?: {
    maxLength?: number
    allowEmpty?: boolean
  }
): Promise<{ allowed: boolean; reason?: string; sanitizedInput?: string }> {
  const { maxLength = 1500, allowEmpty = false } = options || {}

  // Basic validation
  const trimmed = input.trim()
  
  if (!allowEmpty && !trimmed) {
    return { allowed: false, reason: 'Input cannot be empty' }
  }

  if (trimmed.length > maxLength) {
    return { 
      allowed: false, 
      reason: `Input too long. Please limit to ${maxLength} characters.` 
    }
  }

  // Content moderation
  const moderation = await moderateContent(trimmed)
  
  if (moderation.flagged) {
    return { 
      allowed: false, 
      reason: moderation.reason || 'Content not allowed by content policy' 
    }
  }

  return { allowed: true, sanitizedInput: trimmed }
}

/**
 * Post-moderation: Check generated content before returning
 */
export async function postModerate(
  output: string
): Promise<{ allowed: boolean; reason?: string; sanitizedOutput?: string }> {
  if (!output.trim()) {
    return { allowed: true, sanitizedOutput: output }
  }

  const moderation = await moderateContent(output)
  
  if (moderation.flagged) {
    return { 
      allowed: false, 
      reason: moderation.reason || 'Generated content violates content policy' 
    }
  }

  return { allowed: true, sanitizedOutput: output }
}

/**
 * Batch moderation for multiple inputs
 */
export async function moderateBatch(
  inputs: string[],
  options?: { maxLength?: number }
): Promise<Array<{ allowed: boolean; reason?: string; sanitizedInput?: string }>> {
  const results = await Promise.all(
    inputs.map(input => preModerate(input, options))
  )
  
  return results
}

/**
 * Check if content contains potentially sensitive IT security topics
 */
export function checkITSecuritySensitivity(input: string): { 
  isSensitive: boolean
  topics: string[]
  suggestion?: string 
} {
  const sensitivePatterns = [
    { pattern: /hack(ing|er)/i, topic: 'hacking', suggestion: 'Consider focusing on ethical security practices' },
    { pattern: /exploit(ing|s)?/i, topic: 'exploitation', suggestion: 'Consider vulnerability assessment techniques' },
    { pattern: /penetration testing/i, topic: 'pentesting', suggestion: 'Focus on authorized security testing' },
    { pattern: /social engineering/i, topic: 'social engineering', suggestion: 'Focus on security awareness training' },
    { pattern: /password crack/i, topic: 'password cracking', suggestion: 'Consider password security best practices' },
    { pattern: /ddos|denial of service/i, topic: 'DoS attacks', suggestion: 'Focus on availability and resilience' }
  ]

  const detectedTopics: string[] = []
  let suggestion: string | undefined

  for (const { pattern, topic, suggestion: topicSuggestion } of sensitivePatterns) {
    if (pattern.test(input)) {
      detectedTopics.push(topic)
      if (!suggestion) suggestion = topicSuggestion
    }
  }

  return {
    isSensitive: detectedTopics.length > 0,
    topics: detectedTopics,
    suggestion
  }
}

/**
 * Sanitize URLs to ensure they are valid and safe
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url)
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    
    // Block known malicious or inappropriate domains
    const blockedDomains = [
      'malware',
      'phishing',
      'spam',
      'adult',
      // Add more as needed
    ]
    
    const hostname = parsed.hostname.toLowerCase()
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      return null
    }
    
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Validate and sanitize IT learning content
 */
export async function validateITContent(
  content: string,
  type: 'curriculum' | 'assignment' | 'assessment' | 'resources'
): Promise<{
  isValid: boolean
  warnings: string[]
  errors: string[]
  sanitizedContent?: string
}> {
  const warnings: string[] = []
  const errors: string[] = []

  // Pre-moderation check
  const preCheck = await preModerate(content, { maxLength: 10000 })
  if (!preCheck.allowed) {
    errors.push(preCheck.reason || 'Content not allowed')
    return { isValid: false, warnings, errors }
  }

  // IT security sensitivity check
  const securityCheck = checkITSecuritySensitivity(content)
  if (securityCheck.isSensitive) {
    warnings.push(`Content touches on sensitive topics: ${securityCheck.topics.join(', ')}`)
    if (securityCheck.suggestion) {
      warnings.push(securityCheck.suggestion)
    }
  }

  // Type-specific validation
  switch (type) {
    case 'curriculum':
      if (content.length < 100) {
        warnings.push('Curriculum content seems very short')
      }
      break
    case 'assignment':
      if (!content.toLowerCase().includes('objective') && !content.toLowerCase().includes('goal')) {
        warnings.push('Assignment should include clear objectives')
      }
      break
    case 'assessment':
      if (!content.toLowerCase().includes('score') && !content.toLowerCase().includes('rating')) {
        warnings.push('Assessment should include scoring criteria')
      }
      break
    case 'resources':
      // Check for URLs in resources
      const urls = content.match(/https?:\/\/[^\s]+/g) || []
      const invalidUrls = urls.filter(url => !sanitizeURL(url))
      if (invalidUrls.length > 0) {
        errors.push(`Invalid URLs found: ${invalidUrls.join(', ')}`)
      }
      break
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    sanitizedContent: preCheck.sanitizedInput
  }
}