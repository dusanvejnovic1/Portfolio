/**
 * Zod schemas for API requests and responses for mode endpoints
 */

import { z } from 'zod'

// Resources Schemas
export const ResourcesRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  subtopics: z.array(z.string().min(1).max(100)).max(10).optional(),
  maxResults: z.number().min(1).max(20).optional().default(10)
})

export const ResourceCardSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.enum(['web', 'youtube', 'documentation']),
  publisher: z.string().optional(),
  length: z.string().optional(),
  duration: z.number().optional(),
  publishedAt: z.string().optional(),
  lastUpdated: z.string().optional(),
  relevanceScore: z.number().min(0).max(100),
  relevanceRationale: z.string(),
  keyTakeaways: z.array(z.string()),
  isOfficial: z.boolean().optional(),
  badges: z.array(z.enum(['official', 'recent', 'comprehensive', 'beginner-friendly', 'advanced'])).optional(),
  verified: z.boolean().default(false)
})

export const ResourcesResponseSchema = z.object({
  resources: z.array(ResourceCardSchema),
  meta: z.object({
    totalResults: z.number(),
    searchQuery: z.string(),
    generatedAt: z.string()
  })
})

// Assignment Schemas
export const AssignmentRequestSchema = z.object({
  topic: z.string().min(3).max(200),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  constraints: z.any().optional(),
  timeBudgetHrs: z.number().min(0.5).max(40).optional(),
  guidanceStyle: z.enum(['hints', 'solutions']).optional()
})

export const RubricCriterionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  weight: z.number().min(0).max(1),
  levels: z.array(z.object({
    score: z.number().min(0).max(5),
    description: z.string().min(1).max(200)
  })).min(1)
})

export const AssignmentVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  scenario: z.string(),
  objectives: z.array(z.string()),
  steps: z.array(z.string()),
  deliverables: z.array(z.string()),
  rubric: z.array(RubricCriterionSchema),
  hints: z.array(z.string()).optional(),
  stretchGoals: z.array(z.string()).optional()
})

export const AssignmentResponseSchema = z.object({
  set: z.array(AssignmentVariantSchema).length(3)
})

// Assessment Schemas
export const AssessmentRequestSchema = z.object({
  rubric: z.array(RubricCriterionSchema),
  submission: z.string().min(10).max(5000)
})

export const AssessmentResponseSchema = z.object({
  overallScore: z.number().min(0).max(5),
  summary: z.string(),
  whatWasGood: z.array(z.string()),
  needsImprovement: z.array(z.string()),
  mustFix: z.array(z.string()),
  nextSteps: z.array(z.string()),
  rubricBreakdown: z.array(z.object({
    criterion: z.string(),
    score: z.number().min(0).max(5),
    evidence: z.string(),
    feedback: z.string()
  }))
})

// Type exports
export type ResourcesRequest = z.infer<typeof ResourcesRequestSchema>
export type ResourceCard = z.infer<typeof ResourceCardSchema>
export type ResourcesResponse = z.infer<typeof ResourcesResponseSchema>
export type AssignmentRequest = z.infer<typeof AssignmentRequestSchema>
export type AssignmentVariant = z.infer<typeof AssignmentVariantSchema>
export type AssignmentResponse = z.infer<typeof AssignmentResponseSchema>
export type AssessmentRequest = z.infer<typeof AssessmentRequestSchema>
export type AssessmentResponse = z.infer<typeof AssessmentResponseSchema>
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>