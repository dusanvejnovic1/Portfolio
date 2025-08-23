'use client'

import { useState, useCallback, useRef } from 'react'
import { 
  CurriculumGenerateRequest, 
  CurriculumDay,
  CurriculumPlan
} from '@/types/modes'
import { fetchNDJSONStream } from '@/lib/sse'

interface CurriculumStreamMessage {
  type: 'progress' | 'day' | 'error' | 'done' | 'full_plan'
  value?: string
  day?: CurriculumDay
  content?: CurriculumDay // For compatibility with server response format
  error?: string
  totalGenerated?: number
}

function isCurriculumStreamMessage(message: unknown): message is CurriculumStreamMessage {
  if (typeof message !== 'object' || message === null) return false
  const msg = message as CurriculumStreamMessage
  return typeof msg.type === 'string' && ['progress', 'day', 'error', 'done', 'full_plan'].includes(msg.type)
}

interface CurriculumStreamProps {
  request: CurriculumGenerateRequest
  onComplete?: (plan: CurriculumPlan) => void
  onError?: (error: string) => void
}

interface StreamState {
  isStreaming: boolean
  days: CurriculumDay[]
  progress: string
  currentDay: number
  totalDays: number
  error?: string
}

export default function CurriculumStream({ request, onComplete, onError }: CurriculumStreamProps) {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    days: [],
    progress: '',
    currentDay: 0,
    totalDays: request.durationDays
  })
  
  const abortControllerRef = useRef<AbortController | null>(null)
  // Track whether a full_plan was received and whether parent was notified
  const fullPlanReceivedRef = useRef(false)
  const parentNotifiedRef = useRef(false)
  const onCompleteTimeoutRef = useRef<number | null>(null)
  // Helper to normalize titles: remove any repeated leading "Day <n>:" prefixes
  const normalizeTitle = (t?: string) => {
    if (!t) return ''
    return (t || '').replace(/^(\s*Day\s*\d+:\s*)+/i, '').trim()
  }

  const startGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState(prev => ({
      ...prev,
      isStreaming: true,
      days: [],
      progress: 'Starting generation...',
      currentDay: 0,
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
  onMessage: (message: unknown) => {
          if (!isCurriculumStreamMessage(message)) {
            if (typeof message === 'object' && message !== null) {
              const fallback = message as { days?: CurriculumDay[], totalDays?: number }
              if (Array.isArray(fallback.days)) {
                // Dedupe fallback days by stable key
                const makeKey = (d: CurriculumDay) => `${d.day}-${normalizeTitle(d.title)}`
                const seen = new Set<string>()
                const deduped = [] as CurriculumDay[]
                for (const d of fallback.days!) {
                  const k = makeKey(d)
                  if (!seen.has(k)) {
                    seen.add(k)
                    deduped.push(d)
                  }
                }
                deduped.sort((a, b) => a.day - b.day)
                setState(prev => ({
                  ...prev,
                  days: deduped,
                  currentDay: deduped.length,
                  progress: `Loaded ${deduped.length} days from fallback response`
                }))
                return
              }
            }
            return;
          }
          const msg = message as CurriculumStreamMessage;
          
          if (msg.type === 'progress') {
            setState(prev => ({
              ...prev,
              progress: msg.value || ''
            }))
          } else if (msg.type === 'day') {
            // Received lightweight summary during streaming
            const dayData = msg.day || msg.content
            if (dayData) {
              const day = dayData as CurriculumDay
              // Insert/merge summary (may be partial) but avoid overwriting full day later
              setState(prev => {
                const existsIdx = prev.days.findIndex(d => d.day === day.day)
                if (existsIdx !== -1) {
                  // Merge: prefer existing richer fields, but fill in summary/title if missing
                  const existing = prev.days[existsIdx]
                  const merged = {
                    ...existing,
                    title: existing.title || day.title,
                    summary: existing.summary || day.summary
                  }
                  const newDays = [...prev.days]
                  newDays[existsIdx] = merged
                  return {
                    ...prev,
                    days: newDays,
                    currentDay: Math.max(prev.currentDay, day.day),
                    progress: `Completed Day ${day.day}: ${merged.title || day.title}`
                  }
                }

                const newDays = [...prev.days, day]
                newDays.sort((a, b) => a.day - b.day)
                return {
                  ...prev,
                  days: newDays,
                  currentDay: Math.max(prev.currentDay, day.day),
                  progress: `Completed Day ${day.day}: ${day.title}`
                }
              })
            }
          } else if (isCurriculumStreamMessage(msg) && msg.type === 'full_plan') {
            // New: server sent the complete plan with full day objects
            const full = msg.content || (msg as unknown as Record<string, unknown>).value
            if (full && Array.isArray((full as unknown as Record<string, unknown>).days)) {
              // Normalize and dedupe by day number
              const incoming: CurriculumDay[] = (full as unknown as { days: CurriculumDay[] }).days
              incoming.sort((a, b) => a.day - b.day)
              setState(prev => {
                const map = new Map<number, CurriculumDay>()
                // First seed with existing summaries
                for (const d of prev.days) map.set(d.day, d)
                // Overwrite with full incoming days
                for (const d of incoming) map.set(d.day, d)
                const merged = Array.from(map.values()).sort((a, b) => a.day - b.day)
                // Mark full plan received so we can notify parent
                fullPlanReceivedRef.current = true
                // Notify parent now that we have full data (avoid updating during render)
                if (onComplete && !parentNotifiedRef.current) {
                  setTimeout(() => {
                    const plan: CurriculumPlan = {
                      topic: request.topic,
                      level: request.level,
                      durationDays: request.durationDays,
                      outline: request.outline || [],
                      days: merged
                    }
                    try {
                      onComplete(plan)
                      parentNotifiedRef.current = true
                    } catch (e) {
                      console.error('onComplete handler failed:', e)
                    }
                  }, 0)
                }
                return {
                  ...prev,
                  days: merged,
                  currentDay: Math.max(prev.currentDay, merged.length > 0 ? merged[merged.length - 1].day : prev.currentDay),
                  progress: `Full plan received with ${merged.length} days`,
                  isStreaming: false
                }
              })
            }
          } else if (msg.type === 'done') {
            const total = msg.totalGenerated ?? request.durationDays
            setState(prev => ({
              ...prev,
              isStreaming: false,
              totalDays: total,
              progress: `Generation complete! Generated ${prev.days.length} days.`
            }))
            // onComplete will be called from the stream onComplete handler after a short delay
          } else if (msg.type === 'error') {
            const errorMsg = msg.error || 'Generation failed'
            setState(prev => ({
              ...prev,
              error: errorMsg,
              isStreaming: false
            }))
            if (onError) {
              onError(errorMsg)
            }
          }
        },
        onComplete: () => {
          // Capture days and update local state first, then call parent's onComplete
          let capturedDays: CurriculumDay[] = []
          // Clear any previous onComplete timeout
          if (onCompleteTimeoutRef.current) {
            clearTimeout(onCompleteTimeoutRef.current)
            onCompleteTimeoutRef.current = null
          }

          setState(prev => {
            capturedDays = prev.days
            return {
              ...prev,
              isStreaming: false,
              progress: `Generation complete! Generated ${prev.days.length} days.`
            }
          })

          // If we've already received the full plan, the parent was likely notified there.
          if (parentNotifiedRef.current) return

          // Wait a short window for the 'full_plan' event to arrive; if it doesn't, call onComplete with capturedDays
          if (onComplete) {
            onCompleteTimeoutRef.current = window.setTimeout(() => {
              if (!parentNotifiedRef.current) {
                try {
                  const plan: CurriculumPlan = {
                    topic: request.topic,
                    level: request.level,
                    durationDays: request.durationDays,
                    outline: request.outline || [],
                    days: capturedDays
                  }
                  onComplete(plan)
                  parentNotifiedRef.current = true
                } catch (e) {
                  console.error('onComplete failed in fallback timeout:', e)
                }
              }
              onCompleteTimeoutRef.current = null
            }, 400)
          }
        },
        onError: (error) => {
          const errorMsg = error.message || 'Network error occurred'
          setState(prev => ({
            ...prev,
            error: errorMsg,
            isStreaming: false
          }))
          if (onError) {
            onError(errorMsg)
          }
        }
      })
    } catch (error) {
      if (!controller.signal.aborted) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
        setState(prev => ({
          ...prev,
          error: errorMsg,
          isStreaming: false
        }))
        if (onError) {
          onError(errorMsg)
        }
      }
    }
  }, [request, onComplete, onError]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
      progress: 'Generation cancelled'
    }))
  }, [])

  const retryGeneration = useCallback(() => {
    startGeneration()
  }, [startGeneration])

  const exportToMarkdown = useCallback(async () => {
    if (state.days.length === 0) return

    const plan: CurriculumPlan = {
      topic: request.topic,
      level: request.level,
      durationDays: request.durationDays,
      outline: request.outline || [],
      days: state.days
    }

    let exportLib
    try {
      exportLib = await import('@/lib/export/markdown')
    } catch (importError) {
      console.error('Failed to import markdown export module:', importError)
      if (onError) {
        onError('Failed to load markdown export module')
      }
      return
    }

    let markdown
    try {
      markdown = exportLib.exportCurriculumToMarkdown(plan)
    } catch (exportError) {
      console.error('Failed to export curriculum to markdown:', exportError)
      if (onError) {
        onError('Failed to export curriculum to markdown')
      }
      return
    }

    try {
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${plan.topic.replace(/[^a-zA-Z0-9-_]/g, '-')}-curriculum.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export markdown:', error)
      if (onError) {
        onError('Failed to export curriculum to markdown')
      }
    }
  }, [state.days, request, onError]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {request.topic}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {request.level} • {request.durationDays} days
              </p>
            </div>
            <div className="flex gap-2">
              {!state.isStreaming && !state.error && state.days.length === 0 && (
                <button
                  onClick={startGeneration}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Start Generation
                </button>
              )}
              
              {state.isStreaming && (
                <button
                  onClick={cancelGeneration}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              )}
              
              {!state.isStreaming && (state.error || state.days.length > 0) && (
                <button
                  onClick={retryGeneration}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Retry
                </button>
              )}
              
              {state.days.length > 0 && (
                <button
                  onClick={exportToMarkdown}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Export to Markdown
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{state.currentDay} of {state.totalDays} days</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max((state.currentDay / state.totalDays) * 100, 0)}%` }}
              />
            </div>
            {state.progress && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {state.isStreaming && (
                  <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse" />
                )}
                {state.progress}
              </p>
            )}
          </div>

          {/* Error */}
          {state.error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">
                <span className="font-medium">Error:</span> {state.error}
              </p>
            </div>
          )}
        </div>

        {/* Day Cards */}
        {state.days.length > 0 && (
          <div className="p-6">
            <div className="space-y-4">
              {state.days.map((day) => {
                const displayTitle = (day.title || '').replace(/^Day\s*\d+:\s*/i, '')
                // Also ensure we strip repeated prefixes consistently
                const normalizedDisplay = displayTitle.replace(/^(\s*Day\s*\d+:\s*)+/i, '').trim()
                return (
                <div 
                  key={`${day.day}-${normalizedDisplay}`}
                  className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      Day {day.day}: {normalizedDisplay}
                    </h4>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {day.summary}
                  </p>

                  {day.goals && day.goals.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Goals
                      </h5>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                        {day.goals.map((goal, idx) => (
                          <li key={idx}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {day.resources && day.resources.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Resources
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {day.resources.slice(0, 3).map((resource, idx) => (
                          <a
                            key={idx}
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {resource.title}
                          </a>
                        ))}
                        {day.resources.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                            +{day.resources.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!state.isStreaming && state.days.length === 0 && !state.error && (
          <div className="p-12 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Ready to Generate Curriculum
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Click &quot;Start Generation&quot; to begin creating your learning curriculum.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}