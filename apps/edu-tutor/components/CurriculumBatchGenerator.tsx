'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CurriculumDay, CurriculumPlan } from '@/types/modes'
import { FullScreenLoader } from './FullScreenLoader'

interface CurriculumBatchGeneratorProps {
  request: {
    topic: string
    level: 'Beginner' | 'Intermediate' | 'Advanced'
    durationDays: number
    goals?: string[]
  }
  onComplete: (plan: CurriculumPlan) => void
  onError: (error: Error) => void
}

const MAX_CONCURRENCY = 3
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

interface DayGenerationState {
  daysMap: Map<number, CurriculumDay>
  inProgress: Set<number>
  failed: Set<number>
  retryCount: Map<number, number>
}

export function CurriculumBatchGenerator({ 
  request, 
  onComplete, 
  onError 
}: CurriculumBatchGeneratorProps) {
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Initializing...')
  
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map())
  const stateRef = useRef<DayGenerationState>({
    daysMap: new Map(),
    inProgress: new Set(),
    failed: new Set(),
    retryCount: new Map()
  })

  const cleanup = useCallback(() => {
    // Abort all in-flight requests
    abortControllersRef.current.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    })
    abortControllersRef.current.clear()
  }, [])

  const handleCancel = useCallback(() => {
    cleanup()
    onError(new Error('Generation cancelled by user'))
  }, [cleanup, onError])

  const generateDay = useCallback(async (day: number): Promise<CurriculumDay> => {
    const controller = new AbortController()
    abortControllersRef.current.set(day, controller)

    try {
      const response = await fetch('/api/modes/curriculum/generate-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: request.topic,
          level: request.level,
          totalDays: request.durationDays,
          day,
          goals: request.goals
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || `HTTP ${response.status}: Failed to generate day ${day}`)
      }

      const data = await response.json()
      
      if (data.type !== 'day' || !data.day) {
        throw new Error(`Invalid response format for day ${day}`)
      }

      // Validate the day number matches what we requested
      if (data.day.day !== day) {
        throw new Error(`Day number mismatch: requested ${day}, got ${data.day.day}`)
      }

      return data.day as CurriculumDay
    } finally {
      abortControllersRef.current.delete(day)
    }
  }, [request])

  const attemptDayGeneration = useCallback(async (day: number): Promise<void> => {
    const state = stateRef.current
    const currentRetries = state.retryCount.get(day) || 0

    try {
      state.inProgress.add(day)
      state.failed.delete(day)
      
      setStatusText(`Generating Day ${day} of ${request.durationDays}...`)
      
      const dayData = await generateDay(day)
      
      // Success - store the day
      state.daysMap.set(day, dayData)
      state.retryCount.delete(day)
      
      // Update progress
      const completedDays = state.daysMap.size
      setProgress(completedDays / request.durationDays)
      setStatusText(`Generated Day ${day} (${completedDays}/${request.durationDays})`)
      
    } catch (error) {
      console.warn(`Failed to generate day ${day} (attempt ${currentRetries + 1}):`, error)
      
      if (currentRetries < MAX_RETRIES && !(error instanceof Error && error.name === 'AbortError')) {
        // Schedule retry with exponential backoff
        state.retryCount.set(day, currentRetries + 1)
        const delay = RETRY_DELAY_BASE * Math.pow(2, currentRetries)
        
        setTimeout(() => {
          if (!abortControllersRef.current.has(day)) {
            attemptDayGeneration(day)
          }
        }, delay)
      } else {
        // Max retries reached or aborted
        state.failed.add(day)
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.error(`Failed to generate day ${day} after ${MAX_RETRIES} attempts:`, error)
        }
      }
    } finally {
      state.inProgress.delete(day)
    }
  }, [generateDay, request.durationDays])

  const runGeneration = useCallback(async () => {
    const state = stateRef.current
    
    setStatusText('Starting curriculum generation...')
    setProgress(0)

    // Create queue of days to generate
    const dayQueue = Array.from({ length: request.durationDays }, (_, i) => i + 1)
    
    // Process days with limited concurrency
    const runTasks = async () => {
      const promises: Promise<void>[] = []
      
      while (dayQueue.length > 0 || promises.length > 0) {
        // Start new tasks up to concurrency limit
        while (promises.length < MAX_CONCURRENCY && dayQueue.length > 0) {
          const day = dayQueue.shift()!
          const promise = attemptDayGeneration(day)
          promises.push(promise)
        }
        
        // Wait for at least one task to complete
        if (promises.length > 0) {
          await Promise.race(promises)
          
          // Remove completed promises
          for (let i = promises.length - 1; i >= 0; i--) {
            const promise = promises[i]
            if (await Promise.race([promise, Promise.resolve('pending')]) !== 'pending') {
              promises.splice(i, 1)
            }
          }
        }
      }
    }

    try {
      await runTasks()
      
      // Check if we got all days
      if (state.daysMap.size === request.durationDays && state.failed.size === 0) {
        // Success! Build the curriculum plan
        const days = Array.from(state.daysMap.values()).sort((a, b) => a.day - b.day)
        const plan: CurriculumPlan = {
          topic: request.topic,
          level: request.level,
          durationDays: request.durationDays,
          outline: [], // Empty outline for now since we're generating individual days
          days
        }
        
        setStatusText('Generation complete!')
        setProgress(1)
        
        // Small delay to show completion state
        setTimeout(() => {
          onComplete(plan)
        }, 500)
      } else {
        // Some days failed
        const failedDays = Array.from(state.failed).sort((a, b) => a - b)
        throw new Error(`Failed to generate days: ${failedDays.join(', ')}`)
      }
    } catch (error) {
      cleanup()
      onError(error instanceof Error ? error : new Error('Generation failed'))
    }
  }, [request, attemptDayGeneration, cleanup, onComplete, onError])

  // Start generation on mount
  useEffect(() => {
    runGeneration()
  }, [runGeneration])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return (
    <FullScreenLoader
      title="Generating Curriculum"
      subtitle={statusText}
      progress={progress}
      onCancel={handleCancel}
      showCancel={true}
    />
  )
}

export default CurriculumBatchGenerator
