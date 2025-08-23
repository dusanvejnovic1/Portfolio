import { z } from 'zod'

/**
 * Zod schemas for Curriculum mode API requests and SSE events
 * Unified and consistent with the types/modes.ts definitions
 */

export const CurriculumGenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationDays: z.number().min(1).max(180),
  goals: z.array(z.string()).optional(),
  batch: z.object({
    startDay: z.number().min(1),
    endDay: z.number().min(1)
  }).optional(),
  outline: z.array(z.object({
    week: z.number().min(1),
    focus: z.string(),
    notes: z.string().optional()
  })).optional(),
  useWeb: z.boolean().optional(),
  retrievalContext: z.record(z.unknown()).optional()
})

export type CurriculumGenerateRequest = z.infer<typeof CurriculumGenerateRequestSchema>

/**
 * Unified SSE Event schema that matches the actual data flow
 */
export const CurriculumDaySchema = z.object({
  day: z.number(),
  title: z.string().transform(sanitizeContent),
  summary: z.string().transform(sanitizeContent),
  goals: z.array(z.string().transform(sanitizeContent)),
  theorySteps: z.array(z.string().transform(sanitizeContent)),
  handsOnSteps: z.array(z.string().transform(sanitizeContent)),
  resources: z.array(z.object({
    title: z.string().transform(sanitizeContent),
    url: z.string().min(1).transform(sanitizeUrl).refine(url => url.length > 0, {
      message: "Must be a valid URL or domain name"
    }),
    type: z.enum(['documentation', 'video', 'tutorial', 'tool'])
  })).default([]),
  assignment: z.string().default('').transform(sanitizeContent),
  checkForUnderstanding: z.array(z.string().transform(sanitizeContent)).default([])
})

export const CurriculumStreamEventSchema = z.union([
  // Progress event
  z.object({
    type: z.literal('progress'),
    value: z.string()
  }),
  
  // Day event - simplified and consistent
  z.object({
    type: z.literal('day'),
    day: CurriculumDaySchema
  }),
  
  // Error event
  z.object({
    type: z.literal('error'),
    error: z.string()
  }),
  
  // Done event
  z.object({
    type: z.literal('done'),
    totalGenerated: z.number().optional()
  }),
  
  // Full plan event
  z.object({
    type: z.literal('full_plan'),
    plan: z.object({
      days: z.array(CurriculumDaySchema)
    })
  })
])

// Use the types from types/modes.ts instead of inferring from schema

/**
 * Response validation schemas
 */
export const CurriculumOutlineResponseSchema = z.object({
  outline: z.array(z.object({
    week: z.number(),
    focus: z.string(),
    notes: z.string().optional()
  })),
  suggestedAdjustments: z.array(z.string()).optional()
})

export const CurriculumGenerateResponseSchema = z.object({
  days: z.array(CurriculumDaySchema),
  totalDays: z.number()
})

export type CurriculumGenerateResponse = z.infer<typeof CurriculumGenerateResponseSchema>

/**
 * Standardized API Error Response Schema
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
  code: z.string().optional(),
  requestId: z.string().optional()
})

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>

/**
 * Success response wrapper
 */
export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  data: dataSchema,
  requestId: z.string().optional(),
  timestamp: z.string().optional()
})

/**
 * Utility to create standardized error responses
 */
export function createErrorResponse(
  error: string, 
  details?: unknown, 
  code?: string, 
  requestId?: string
): ApiErrorResponse {
  const response: ApiErrorResponse = { error }
  
  if (details !== undefined) {
    response.details = details
  }
  if (code !== undefined) {
    response.code = code
  }
  if (requestId !== undefined) {
    response.requestId = requestId
  }
  
  return response
}

/**
 * Runtime validation utilities
 */
export function validateCurriculumDay(data: unknown): data is import('@/types/modes').CurriculumDay {
  try {
    CurriculumDaySchema.parse(data)
    return true
  } catch {
    return false
  }
}

export function validateCurriculumStreamEvent(data: unknown): data is import('@/types/modes').CurriculumStreamEvent {
  try {
    CurriculumStreamEventSchema.parse(data)
    return true
  } catch {
    return false
  }
}

/**
 * Content sanitization utilities
 */
export function sanitizeUrl(url: string): string {
  try {
    // Basic URL validation - allow http/https/ftp protocols
    const parsed = new URL(url)
    if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
      return ''
    }
    return url
  } catch {
    // If not a valid URL, check if it's a domain name
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(url)) {
      return `https://${url}`
    }
    return ''
  }
}

export function sanitizeContent(content: string): string {
  // Basic content sanitization - remove potentially dangerous characters
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}