'use client'

import { useState } from 'react'
import { 
  AssignmentSet, 
  AssignmentVariant,
  AssignmentGenerateRequest,
  LearningLevel
} from '@/types/modes'
import type { AssignmentSummary } from '@/components/AssignmentGenerator'

// Local set type that supports streaming summary items until full variants replace them
type LocalAssignmentSet = Omit<AssignmentSet, 'variants'> & { variants: (AssignmentSummary | AssignmentVariant)[] }
import AssignmentGenerator from '@/components/AssignmentGenerator'

export default function AssignmentMode() {
  const [step, setStep] = useState<'setup' | 'view'>('setup')
  const [formData] = useState<Partial<AssignmentGenerateRequest>>({
    topic: '',
    difficulty: 'Beginner',
  // timeBudgetHrs intentionally omitted to avoid sending a default 4-hour budget
    guidanceStyle: 'hints'
  })
  const [currentSet, setCurrentSet] = useState<LocalAssignmentSet | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  
  // Helpers to safely read fields from either a compact AssignmentSummary or full AssignmentVariant
  const isFullVariant = (v?: AssignmentSummary | AssignmentVariant): v is AssignmentVariant => {
    return !!v && typeof (v as AssignmentVariant).scenario === 'string' && Array.isArray((v as AssignmentVariant).objectives)
  }

  const getTitle = (v?: AssignmentSummary | AssignmentVariant) => v?.title || 'Untitled'
  const getScenario = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? v.scenario : (v?.summary || 'No scenario available.')
  const getObjectives = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.objectives || []) : (v?.summary ? [v.summary] : [])
  const getSteps = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.steps || []) : []
  const getDeliverables = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.deliverables || []) : []
  const getRubric = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.rubric || []) : []
  const getHints = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.hints || []) : []
  const getStretch = (v?: AssignmentSummary | AssignmentVariant) => isFullVariant(v) ? (v.stretchGoals || []) : []


  // We'll use the streaming AssignmentGenerator instead of one-shot fetch
  const handleGeneratorItem = (assignment: AssignmentSummary) => {
    // Debug: log incoming item
    console.debug('handleGeneratorItem called with', assignment)

    // Append to an in-progress set shown in the UI
    setCurrentSet(prev => {
      const cur: LocalAssignmentSet = prev || { topic: formData.topic || '', difficulty: (formData.difficulty as LearningLevel) || 'Beginner', variants: [], timeBudgetHrs: formData.timeBudgetHrs }
      // Avoid duplicates by id
    if (cur.variants.find(v => v.id === assignment.id)) return cur
    const assignedId = assignment.id && String(assignment.id).trim()
      ? String(assignment.id)
      : (typeof crypto !== 'undefined' && typeof (crypto as unknown as { randomUUID?: () => string }).randomUUID === 'function'
        ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
        : `${Date.now()}-${Math.random()}`)
    const itemWithId = { ...assignment, id: assignedId }
    console.debug('Generator item received', itemWithId)
    const updated = { ...cur, variants: [...cur.variants, itemWithId] }
    console.debug('Updated currentSet', updated)
    return updated
    })
  }

  const handleGeneratorComplete = (data: AssignmentVariant[]) => {
  console.debug('handleGeneratorComplete called with', data?.length || 0, 'items')
  // Store compact summaries only to avoid very large final payloads.
    const summaries = (data || []).map(v => ({
      id: v.id,
      title: v.title,
  summary: v.scenario ? String(v.scenario).slice(0, 300) : ((v.objectives && v.objectives.length) ? (v.objectives || []).slice(0,3).join(', ') : (v.title || '')),
      truncated: true
    })) as (AssignmentSummary | AssignmentVariant)[]

    const final: LocalAssignmentSet = {
      topic: formData.topic || '',
      difficulty: formData.difficulty || 'Beginner',
      variants: summaries,
      timeBudgetHrs: formData.timeBudgetHrs
    }
    setCurrentSet(final)
    setSelectedVariant(final.variants?.[0]?.id || null)
    setStep('view')
  }

  // Expand a compact summary into a full variant on demand.
  const expandVariant = async (variantId?: string) => {
    if (!variantId || !currentSet) return
    const idx = currentSet.variants.findIndex(v => v.id === variantId)
    if (idx === -1) return
    const v = currentSet.variants[idx]
    if (isFullVariant(v)) return

    // optimistic UI: mark loading
    setCurrentSet(prev => {
      if (!prev) return prev
  const copy = { ...prev, variants: [...prev.variants] }
  // mark loading flag on the specific variant without using `any`
  const orig = copy.variants[idx]
  const withLoading = { ...(orig as unknown as Record<string, unknown>), loading: true }
  copy.variants[idx] = withLoading as unknown as AssignmentSummary | AssignmentVariant
  return copy
    })

    try {
      const res = await fetch('/api/modes/assignment/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: v })
      })
      if (!res.ok) throw new Error(`Expand failed: ${res.status}`)
      const full: AssignmentVariant = await res.json()
      setCurrentSet(prev => {
        if (!prev) return prev
        const copy = { ...prev, variants: [...prev.variants] }
        copy.variants[idx] = full
        return copy
      })
    } catch (err) {
      console.error('Failed to expand variant', err)
      // clear loading flag
      setCurrentSet(prev => {
        if (!prev) return prev
  const copy = { ...prev, variants: [...prev.variants] }
  const orig = copy.variants[idx]
  const withoutLoading = { ...(orig as unknown as Record<string, unknown>) }
  delete (withoutLoading as Record<string, unknown>).loading
  copy.variants[idx] = withoutLoading as unknown as AssignmentSummary | AssignmentVariant
  return copy
      })
    }
  }


  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Generate Assignments
        </h2>

  <AssignmentGenerator onItem={handleGeneratorItem} onComplete={(set) => handleGeneratorComplete(set as AssignmentVariant[])} />

        {/* Debug panel: show currentSet JSON for troubleshooting */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 border rounded text-xs">
          <div className="font-medium mb-1">Debug: currentSet snapshot</div>
          <pre className="whitespace-pre-wrap max-h-40 overflow-auto text-[10px]">{JSON.stringify(currentSet, null, 2)}</pre>
        </div>

        {/* Show quick save list of generated variants */}
        {/* Debug: currentSet JSON to help diagnose missing UI updates */}
        {currentSet && (
          <pre className="mt-4 p-2 bg-gray-100 dark:bg-gray-900 text-xs overflow-auto max-h-40">{JSON.stringify(currentSet, null, 2)}</pre>
        )}
        {currentSet && currentSet.variants && currentSet.variants.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">In-progress Variants</h3>
            <div className="space-y-2">
              {currentSet.variants.map(v => (
                <div key={v.id} className="p-3 border rounded-md bg-white dark:bg-gray-800">
                  <div className="flex justify-between">
                    <div className="font-medium">{v.title}</div>
                    <div className="text-sm text-gray-500">{currentSet.difficulty}</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{getObjectives(v).slice(0,3).join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (step === 'view' && currentSet) {
    const selectedAssignment = currentSet.variants.find(v => v.id === selectedVariant) || currentSet.variants[0]

    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currentSet.topic} Assignments - {currentSet.difficulty} Level
          </h2>
          <button
            onClick={() => setStep('setup')}
            className="py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm"
          >
            Generate New
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Assignment Variants Selector */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Variants</h3>
            <div className="space-y-2">
              {currentSet.variants.map((variant, index) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant.id ?? null)}
                  className={`w-full text-left p-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border transition-colors ${
                    selectedVariant === variant.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`font-medium text-sm mb-1 ${
                    selectedVariant === variant.id
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    Variant {index + 1}
                  </div>
                  <div className={`text-xs ${
                    selectedVariant === variant.id
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {getTitle(variant).substring(0, 50)}...
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Assignment Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {getTitle(selectedAssignment)}
                </h3>
                {!isFullVariant(selectedAssignment) && (
                  <button
                    onClick={() => selectedAssignment?.id && expandVariant(selectedAssignment.id)}
                    className="ml-4 py-1 px-3 bg-blue-600 text-white rounded text-sm"
                  >
                    Expand
                  </button>
                )}
              </div>
              
              <div className="prose dark:prose-invert max-w-none">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Scenario</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {getScenario(selectedAssignment)}
                </p>
                
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Learning Objectives</h4>
                <ul className="list-disc list-inside space-y-1 mb-6">
                    {getObjectives(selectedAssignment).map((objective: string, index: number) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{objective}</li>
                    ))}
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Steps to Complete</h4>
                <ol className="list-decimal list-inside space-y-2 mb-6">
                    {getSteps(selectedAssignment).map((step: string, index: number) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{step}</li>
                    ))}
                </ol>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Deliverables</h4>
                <ul className="list-disc list-inside space-y-1 mb-6">
                    {getDeliverables(selectedAssignment).map((deliverable: string, index: number) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{deliverable}</li>
                    ))}
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Assessment Rubric</h4>
                <div className="space-y-4 mb-6">
      {getRubric(selectedAssignment).map((criterion: unknown, index: number) => {
                    const crit = criterion as { name?: string; weight?: number; description?: string; levels?: unknown[] }
                    return (
                      <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          {crit.name} <span className="text-sm text-gray-500">({Math.round((crit.weight || 0) * 100)}%)</span>
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{crit.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {(crit.levels || []).map((level: unknown, levelIndex: number) => {
                            const lv = level as { score?: number; description?: string }
                            return (
                              <div key={levelIndex} className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  Score: {lv.score ?? 0}/5
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">
                                  {lv.description}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {getHints(selectedAssignment).length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Hints</h4>
                    <ul className="list-disc list-inside space-y-1 mb-6">
                      {getHints(selectedAssignment).map((hint: string, index: number) => (
                        <li key={index} className="text-gray-600 dark:text-gray-400">{hint}</li>
                      ))}
                    </ul>
                  </>
                )}

                {getStretch(selectedAssignment).length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Stretch Goals (Optional)</h4>
                    <ul className="list-disc list-inside space-y-1 mb-6">
                      {getStretch(selectedAssignment).map((goal: string, index: number) => (
                        <li key={index} className="text-gray-600 dark:text-gray-400">{goal}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}