'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { 
  CurriculumGenerateRequest, 
  CurriculumDay,
  CurriculumPlan,
  CurriculumStreamEvent
} from '@/types/modes'
import { validateCurriculumStreamEvent, validateCurriculumDay } from '@/lib/schemas/curriculum'
import { fetchNDJSONStream } from '@/lib/sse'

interface CurriculumStreamProps {
  request: CurriculumGenerateRequest
  onComplete?: (plan: CurriculumPlan) => void
  onError?: (error: string) => void
}

type StreamStatus = 'idle' | 'generating' | 'completed' | 'error'

interface StreamState {
  status: StreamStatus
  progress: string
  days: CurriculumDay[]
  error?: string
  retryCount: number
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

export default function CurriculumStream({ request, onComplete, onError }: CurriculumStreamProps) {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    progress: 'Ready to generate curriculum',
    days: [],
    retryCount: 0
  })
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const completionNotifiedRef = useRef(false)

  // Cleanup function to prevent memory leaks
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    completionNotifiedRef.current = false
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Forward declaration for startGeneration
  const startGenerationRef = useRef<(() => Promise<void>) | null>(null)

  // Retry mechanism with exponential backoff
  const scheduleRetry = useCallback((error: string) => {
    setState(prev => {
      if (prev.retryCount >= MAX_RETRIES) {
        onError?.(error)
        return {
          ...prev,
          status: 'error',
          error: `Failed after ${MAX_RETRIES} attempts: ${error}`
        }
      }

      const delay = RETRY_DELAY_MS * Math.pow(2, prev.retryCount)
      
      setTimeout(() => {
        startGenerationRef.current?.()
      }, delay)

      return {
        ...prev,
        progress: `Retrying in ${delay/1000}s... (attempt ${prev.retryCount + 1}/${MAX_RETRIES})`,
        retryCount: prev.retryCount + 1
      }
    })
  }, [onError])

  // Notify completion only once
  const notifyCompletion = useCallback((days: CurriculumDay[]) => {
    if (completionNotifiedRef.current || !onComplete) return

    const plan: CurriculumPlan = {
      topic: request.topic,
      level: request.level,
      durationDays: request.durationDays,
      outline: request.outline || [],
      days
    }

    onComplete(plan)
    completionNotifiedRef.current = true
  }, [request, onComplete])

  // Memoized day processing for performance
  const processDayUpdate = useCallback((currentDays: CurriculumDay[], newDay: CurriculumDay): CurriculumDay[] => {
    const existingIndex = currentDays.findIndex(d => d.day === newDay.day)
    
    if (existingIndex !== -1) {
      // Update existing day without re-sorting
      const updatedDays = [...currentDays]
      updatedDays[existingIndex] = newDay
      return updatedDays
    } else {
      // Add new day and sort only once
      return [...currentDays, newDay].sort((a: CurriculumDay, b: CurriculumDay) => a.day - b.day)
    }
  }, [])

  // Process streaming events
  const handleStreamEvent = useCallback((message: unknown) => {
    if (!validateCurriculumStreamEvent(message)) {
      return
    }

    const event = message as CurriculumStreamEvent

    setState(prev => {
      switch (event.type) {
        case 'progress': {
          const progressEvent = event as { type: 'progress'; value: string }
          return {
            ...prev,
            progress: progressEvent.value || prev.progress
          }
        }

        case 'day': {
          const dayEvent = event as { type: 'day'; day: CurriculumDay }
          if (!validateCurriculumDay(dayEvent.day)) {
            return prev
          }

          const newDays = processDayUpdate(prev.days, dayEvent.day)

          return {
            ...prev,
            days: newDays,
            progress: `Generated Day ${dayEvent.day.day}: ${dayEvent.day.title}`
          }
        }

        case 'full_plan': {
          const planEvent = event as { type: 'full_plan'; plan: { days: CurriculumDay[] } }
          if (planEvent.plan?.days) {
            const validDays = planEvent.plan.days.filter(validateCurriculumDay)
            return {
              ...prev,
              days: validDays.sort((a: CurriculumDay, b: CurriculumDay) => a.day - b.day),
              status: 'completed',
              progress: `Full plan received with ${validDays.length} days`
            }
          }
          return prev
        }

        case 'done':
          const completedState = {
            ...prev,
            status: 'completed' as const,
            progress: `Generation complete! Generated ${prev.days.length} days.`,
            retryCount: 0 // Reset retry count on success
          }

          // Notify completion asynchronously to avoid state update conflicts
          setTimeout(() => notifyCompletion(completedState.days), 0)
          
          return completedState

        case 'error': {
          const errorEvent = event as { type: 'error'; error: string }
          return {
            ...prev,
            status: 'error' as const,
            error: errorEvent.error,
            progress: `Error: ${errorEvent.error}`
          }
        }

        default:
          return prev
      }
    })
  }, [notifyCompletion, processDayUpdate])

  // Handle stream completion
  const handleStreamComplete = useCallback(() => {
    setState(prev => {
      if (prev.status === 'generating') {
        const completedState = {
          ...prev,
          status: 'completed' as const,
          progress: `Generation complete! Generated ${prev.days.length} days.`
        }

        // Notify completion if we have days
        if (prev.days.length > 0) {
          setTimeout(() => notifyCompletion(prev.days), 0)
        }

        return completedState
      }
      return prev
    })
  }, [notifyCompletion])

  // Handle stream errors
  const handleStreamError = useCallback((error: Error) => {
    const errorMessage = error.message || 'Stream connection failed'
    
    // Check if it's a network error that should be retried
    if (error.message.includes('fetch') || error.message.includes('network')) {
      scheduleRetry(errorMessage)
    } else {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        progress: `Error: ${errorMessage}`
      }))
      onError?.(errorMessage)
    }
  }, [scheduleRetry, onError])

  // Start generation process
  const startGeneration = useCallback(async () => {
    // Clean up any existing stream
    cleanup()

    const controller = new AbortController()
    abortControllerRef.current = controller

    setState(prev => ({
      ...prev,
      status: 'generating',
      progress: 'Starting curriculum generation...',
      error: undefined
    }))

    try {
      await fetchNDJSONStream('/api/modes/curriculum/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal,
        onMessage: handleStreamEvent,
        onComplete: handleStreamComplete,
        onError: handleStreamError
      })
    } catch (error) {
      handleStreamError(error instanceof Error ? error : new Error(String(error)))
    }
  }, [request, cleanup, handleStreamEvent, handleStreamComplete, handleStreamError])

  // Set the ref after startGeneration is defined
  useEffect(() => {
    startGenerationRef.current = startGeneration
  }, [startGeneration])

  // Export to markdown functionality
  const exportToMarkdown = useCallback(async () => {
    if (state.days.length === 0) return

    try {
      const { exportCurriculumToMarkdown } = await import('@/lib/export/markdown')
      const plan: CurriculumPlan = {
        topic: request.topic,
        level: request.level,
        durationDays: request.durationDays,
        outline: request.outline || [],
        days: state.days
      }
      await exportCurriculumToMarkdown(plan)
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Export failed: ' + (error instanceof Error ? error.message : String(error))
      }))
    }
  }, [state.days, request])

  // Memoized progress calculation for performance
  const progressPercentage = useMemo(() => {
    return Math.min(100, (state.days.length / request.durationDays) * 100)
  }, [state.days.length, request.durationDays])

  // Memoized day list to prevent unnecessary re-renders
  const renderedDays = useMemo(() => {
    return state.days.map((day) => (
      <div 
        key={day.day}
        className="p-4 border border-gray-200 dark:border-gray-700 rounded-md"
      >
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          Day {day.day}: {day.title}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {day.summary}
        </p>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          {day.goals.length} goals • {day.theorySteps.length} theory steps • {day.handsOnSteps.length} hands-on steps
        </div>
      </div>
    ))
  }, [state.days])

  // UI Rendering
  if (state.status === 'idle') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <button
            onClick={startGeneration}
            className="py-3 px-8 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-lg font-medium"
          >
            Start Generation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Generation Progress
          </h3>
          {state.status === 'generating' && (
            <button
              onClick={cleanup}
              className="py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>{state.progress}</span>
            <span>{state.days.length} / {request.durationDays} days</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                state.status === 'error' ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ 
                width: `${progressPercentage}%` 
              }}
            />
          </div>
        </div>

        {state.status === 'generating' && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
            <span>Generating curriculum...</span>
          </div>
        )}

        {state.error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="text-red-800 dark:text-red-400 text-sm">
              {state.error}
            </div>
          </div>
        )}
      </div>

      {/* Generated Days */}
      {state.days.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Generated Days ({state.days.length})
            </h3>
            {state.status === 'completed' && (
              <button
                onClick={exportToMarkdown}
                className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
              >
                📄 Export MD
              </button>
            )}
          </div>

          <div className="space-y-3">
            {renderedDays}
          </div>
        </div>
      )}
    </div>
  )
}