/**
 * Simplified, robust streaming processor for curriculum generation
 * Replaces the complex buffer management with a clean, predictable approach
 */

import { validateCurriculumDay, validateCurriculumStreamEvent } from '@/lib/schemas/curriculum'
import type { CurriculumDay, CurriculumStreamEvent } from '@/types/modes'

export interface StreamProcessor {
  processChunk: (chunk: string) => void
  flush: () => void
  getStats: () => StreamStats
}

export interface StreamStats {
  processedDays: number
  processedEvents: number
  errors: number
  lastError?: string
}

export interface StreamProcessorOptions {
  onEvent: (event: CurriculumStreamEvent) => void
  onError: (error: Error) => void
  maxBufferSize?: number
}

/**
 * Creates a simplified streaming processor that:
 * 1. Buffers incoming text until complete JSON objects are found
 * 2. Parses each complete JSON object as a curriculum event
 * 3. Validates and emits events through callbacks
 * 4. Handles errors gracefully with proper cleanup
 */
export function createStreamProcessor(options: StreamProcessorOptions): StreamProcessor {
  const { onEvent, onError, maxBufferSize = 64 * 1024 } = options
  
  let buffer = ''
  const stats: StreamStats = {
    processedDays: 0,
    processedEvents: 0,
    errors: 0
  }

  const processJSON = (jsonStr: string): void => {
    try {
      const parsed = JSON.parse(jsonStr)
      
      // Validate the event structure
      if (!validateCurriculumStreamEvent(parsed)) {
        throw new Error(`Invalid event structure: ${JSON.stringify(parsed)}`)
      }

      const event = parsed as CurriculumStreamEvent
      
      // Additional validation for day events
      if (event.type === 'day') {
        const dayEvent = event as { type: 'day'; day: CurriculumDay }
        if (!validateCurriculumDay(dayEvent.day)) {
          throw new Error(`Invalid day data: ${JSON.stringify(dayEvent.day)}`)
        }
      }

      // Update stats
      stats.processedEvents++
      if (event.type === 'day') {
        stats.processedDays++
      }

      // Emit the validated event
      try {
        onEvent(event)
      } catch (emitError) {
        // If the onEvent callback fails (e.g., controller closed), just log it
        stats.errors++
        stats.lastError = `Event emission failed: ${emitError instanceof Error ? emitError.message : String(emitError)}`
      }
      
    } catch (error) {
      stats.errors++
      stats.lastError = error instanceof Error ? error.message : String(error)
      
      const parseError = new Error(`Failed to process JSON: ${stats.lastError}`)
      try {
        onError(parseError)
      } catch (errorHandlerError) {
        // If the error handler also fails, just log it and continue
        stats.lastError = `Error handler failed: ${errorHandlerError instanceof Error ? errorHandlerError.message : String(errorHandlerError)}`
      }
    }
  }

  const processChunk = (chunk: string): void => {
    if (!chunk) return

    buffer += chunk

    // Prevent unbounded buffer growth
    if (buffer.length > maxBufferSize) {
      const error = new Error(`Buffer overflow: exceeded ${maxBufferSize} bytes`)
      try {
        onError(error)
      } catch {
        // If error handler fails, just continue
      }
      // Keep only the last portion of the buffer
      buffer = buffer.slice(-maxBufferSize / 2)
      stats.errors++
      return
    }

    // Process complete lines (NDJSON format)
    const lines = buffer.split('\n')
    
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() || ''

    // Process each complete line
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Handle SSE format (data: prefix)
      const content = trimmed.startsWith('data:') 
        ? trimmed.slice(5).trim() 
        : trimmed

      if (!content || content === '[DONE]') continue

      // Try to parse as JSON
      if (content.startsWith('{') && content.endsWith('}')) {
        processJSON(content)
      }
    }
  }

  const flush = (): void => {
    // Process any remaining buffer content
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        processJSON(trimmed)
      }
      buffer = ''
    }

    // Emit final done event if not already received
    const doneEvent = {
      type: 'done' as const,
      totalGenerated: stats.processedDays
    }
    try {
      onEvent(doneEvent)
    } catch (emitError) {
      // If final event emission fails, just log it
      stats.errors++
      stats.lastError = `Final event emission failed: ${emitError instanceof Error ? emitError.message : String(emitError)}`
    }
  }

  const getStats = (): StreamStats => ({ ...stats })

  return {
    processChunk,
    flush,
    getStats
  }
}

/**
 * Utility to normalize LLM-generated day data into proper CurriculumDay format
 */
export function normalizeDayData(data: unknown): CurriculumDay | null {
  if (!data || typeof data !== 'object') return null
  
  const obj = data as Record<string, unknown>
  
  // Extract day number from various possible sources
  let dayNum = typeof obj.day === 'number' ? obj.day : 0
  if (!dayNum && typeof obj.index === 'number') dayNum = obj.index
  if (!dayNum && typeof obj.title === 'string') {
    const match = obj.title.match(/day\s*(\d+)/i)
    if (match) dayNum = parseInt(match[1])
  }
  
  if (!dayNum || dayNum < 1) return null

  // Ensure required fields exist with defaults
  const normalized: CurriculumDay = {
    day: dayNum,
    title: String(obj.title || `Day ${dayNum}`),
    summary: String(obj.summary || ''),
    goals: Array.isArray(obj.goals) ? obj.goals.map(String) : [],
    theorySteps: Array.isArray(obj.theorySteps) ? obj.theorySteps.map(String) : [],
    handsOnSteps: Array.isArray(obj.handsOnSteps) ? obj.handsOnSteps.map(String) : [],
    assignment: String(obj.assignment || ''),
    checkForUnderstanding: Array.isArray(obj.checkForUnderstanding) 
      ? obj.checkForUnderstanding.map(String) 
      : [],
    resources: Array.isArray(obj.resources) ? obj.resources.map((r: unknown) => {
      const resource = r as Record<string, unknown>
      return {
        title: String(resource?.title || 'Resource'),
        url: String(resource?.url || ''),
        type: ['documentation', 'video', 'tutorial', 'tool'].includes(resource?.type as string) 
          ? resource.type as 'documentation' | 'video' | 'tutorial' | 'tool'
          : 'documentation' as const
      }
    }) : []
  }

  return normalized
}
