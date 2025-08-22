import { z } from 'zod'

/**
 * Zod schemas for Curriculum mode API requests and SSE events
 */

export const CurriculumGenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationDays: z.number().min(1).max(180),
  goals: z.array(z.string()).optional()
})

export type CurriculumGenerateRequest = z.infer<typeof CurriculumGenerateRequestSchema>

/**
 * SSE Event types for curriculum generation streaming
 */
export const CurriculumSSEEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('day'),
    index: z.number(),
    title: z.string(),
    content: z.object({
      day: z.number(),
      title: z.string(),
      summary: z.string(),
      goals: z.array(z.string()),
      theorySteps: z.array(z.string()),
      handsOnSteps: z.array(z.string()),
      resources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        type: z.enum(['documentation', 'video', 'tutorial', 'tool'])
      })),
      assignment: z.string(),
      checkForUnderstanding: z.array(z.string())
    }),
    totalDays: z.number()
  }),
  z.object({
    type: z.literal('done'),
    totalGenerated: z.number().optional()
  }),
  z.object({
    type: z.literal('error'),
    error: z.string()
  })
])

export type CurriculumSSEEvent = z.infer<typeof CurriculumSSEEventSchema>

/**
 * JSON fallback response schema
 */
export const CurriculumGenerateResponseSchema = z.object({
  days: z.array(z.object({
    day: z.number(),
    title: z.string(),
    summary: z.string(),
    goals: z.array(z.string()),
    theorySteps: z.array(z.string()),
    handsOnSteps: z.array(z.string()),
    resources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      type: z.enum(['documentation', 'video', 'tutorial', 'tool'])
    })),
    assignment: z.string(),
    checkForUnderstanding: z.array(z.string())
  })),
  totalDays: z.number()
})

export type CurriculumGenerateResponse = z.infer<typeof CurriculumGenerateResponseSchema>