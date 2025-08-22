import { z } from 'zod'

/**
 * Zod schemas for Curriculum mode API requests and SSE events
 */

export const CurriculumGenerateRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  durationDays: z.number().min(1).max(180),
  goals: z.array(z.string()).optional(),
  // Optional batch (client sends this when generating partial ranges)
  batch: z.object({
    startDay: z.number().min(1),
    endDay: z.number().min(1)
  }).optional(),
  // Optional outline structure (client may include outline when requesting detailed days)
  outline: z.array(z.object({
    week: z.number().min(1),
    focus: z.string(),
    notes: z.string().optional()
  })).optional()
})

export type CurriculumGenerateRequest = z.infer<typeof CurriculumGenerateRequestSchema>

/**
 * SSE Event types for curriculum generation streaming
 *
 * Make day events tolerant: model or server may emit the day payload either as
 * "content" (preferred) or directly as "day". Also accept "progress" events.
 */
const DayContentSchema = z.object({
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
})

export const CurriculumSSEEventSchema = z.union([
  // Day event: either provide "content" OR "day" object; ensure one is present via refine
  z.object({
    type: z.literal('day'),
    index: z.number(),
    title: z.string(),
    content: DayContentSchema.optional(),
    day: DayContentSchema.optional(),
    totalDays: z.number()
  }).refine(obj => !!obj.content || !!obj.day, {
    message: 'Day event must include either "content" or "day" payload'
  }),
  // Done event
  z.object({
    type: z.literal('done'),
    totalGenerated: z.number().optional()
  }),
  // Error event
  z.object({
    type: z.literal('error'),
    error: z.string()
  }),
  // Progress event (human-readable progress updates)
  z.object({
    type: z.literal('progress'),
    value: z.string()
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