import { z } from 'zod'

export const chatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(1500, 'Message too long. Please limit to 1500 characters.'),
  mode: z.enum(['hints', 'solution']).optional().default('hints')
})

export const moderateRequestSchema = z.object({
  input: z.string()
    .min(1, 'Input is required')
    .max(1500, 'Input too long. Please limit to 1500 characters.')
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ModerateRequest = z.infer<typeof moderateRequestSchema>