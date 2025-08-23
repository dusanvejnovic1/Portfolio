"use client"

import { useState, useRef } from 'react'
import { fetchNDJSONStream } from '@/lib/sse'

export interface AssignmentSummary {
  id?: string
  day?: number
  title: string
  summary?: string
  description?: string
  resources?: Array<{ title: string; url: string }>
  difficulty?: string
  length?: string
  tags?: string[]
}
export default function AssignmentGenerator({ onComplete, onItem }: { onComplete?: (assignments: AssignmentSummary[]) => void, onItem?: (assignment: AssignmentSummary) => void }) {
  const [typeText, setTypeText] = useState('')
  const [additional, setAdditional] = useState('')
  // UI labels (left -> right)
  const difficultyLabels = ['Very Easy','Easy','Intermediate','Upper Intermediate','Hard','Very Hard','Impossible']
  const lengthLabels = ['Very Short','Short','Medium','Long','Huge']
  const [difficultyIdx, setDifficultyIdx] = useState(2)
  const [lengthIdx, setLengthIdx] = useState(2)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Map the detailed slider labels into the schema's difficulty enum
  const mapDifficultyToSchema = (idx: number) => {
    if (idx <= 1) return 'Beginner'
    if (idx <= 4) return 'Intermediate'
    return 'Advanced'
  }

  // lengthDescriptions intentionally unused for now

  const handleGenerate = async () => {
    if (isGenerating) return
    // basic client-side validation to avoid server Zod errors
    if ((typeText || '').trim().length < 3) {
      setProgress('Please enter at least 3 characters for Type')
      return
    }

    setAssignments([])
    setProgress('Starting generation...')
    setIsGenerating(true)
    const controller = new AbortController()
    abortRef.current = controller

    const payload = {
      topic: typeText || '',
      difficulty: mapDifficultyToSchema(difficultyIdx),
      guidanceStyle: 'hints',
  count: 1, // lower count for faster generation
      additionalRequirements: additional || ''
    }

    try {
      await fetchNDJSONStream('/api/modes/assignment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload),
        signal: controller.signal,
        onMessage: (msg: unknown) => {
          if (!msg || typeof msg !== 'object') return
          const m = msg as Record<string, unknown>
          const type = String(m.type || '')
          if (type === 'progress') setProgress(String(m.value || ''))
          else if (type === 'assignment' && m.assignment && typeof m.assignment === 'object') {
            const a = m.assignment as Record<string, unknown>
            setAssignments(prev => {
              const id = String(a.id || '')
              if (prev.find(p => p.id === id)) return prev
              const nextItem: AssignmentSummary = {
                id,
                day: prev.length + 1,
                title: String(a.title || 'Untitled'),
                summary: String(a.summary || ''),
                difficulty: mapDifficultyToSchema(difficultyIdx),
                length: lengthLabels[lengthIdx]
              }
              const next = [...prev, nextItem]
              if (onItem) onItem(nextItem)
              return next
            })
          } else if (type === 'variant' && m.variant && typeof m.variant === 'object') {
            const v = m.variant as Record<string, unknown>
            setAssignments(prev => {
              const id = String(v.id || '')
              if (prev.find(p => p.id === id)) return prev
              const nextItem: AssignmentSummary = {
                id,
                day: prev.length + 1,
                title: String(v.title || 'Untitled'),
                summary: String(((v.objectives as unknown[] | undefined) || []).slice(0,3).join(', ')),
                difficulty: mapDifficultyToSchema(difficultyIdx),
                length: lengthLabels[lengthIdx]
              }
              const next = [...prev, nextItem]
              if (onItem) onItem(nextItem)
              return next
            })
          } else if (type === 'full_set' && Array.isArray(m.set)) {
            const arr = m.set as unknown[]
            const normalized = arr.map((v, i) => {
              const obj = v as Record<string, unknown>
              return {
                id: String(obj.id || i),
                day: i + 1,
                title: String(obj.title || obj.scenario || `Assignment ${i + 1}`),
                summary: String(((obj.objectives as unknown[] | undefined) || []).join(', ')),
                description: Array.isArray(obj.steps) ? (obj.steps as string[]).join('\n') : String(obj.scenario || ''),
                difficulty: mapDifficultyToSchema(difficultyIdx),
                length: lengthLabels[lengthIdx],
                tags: [] as string[]
              } as AssignmentSummary
            })
            setAssignments(normalized)
            setProgress('Generation complete')
            if (onComplete) onComplete(normalized)
          }
        },
        onComplete: () => {
          setIsGenerating(false)
        },
        onError: (err: unknown) => {
          setIsGenerating(false)
          const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : 'Generation failed')
          setProgress(msg)
        }
      })
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : 'Generation failed')
        setProgress(msg)
      }
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Generate Assignments</h3>

      <div className="grid grid-cols-1 gap-4">
        <label className="block">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Type</span>
            <span className="text-xs text-gray-500">example: JavaScript</span>
          </div>
          <input value={typeText} onChange={e => setTypeText(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-gray-100" />
        </label>

        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium">Difficulty</label>
            <input type="range" min={0} max={difficultyLabels.length - 1} value={difficultyIdx}
              onChange={e => setDifficultyIdx(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
          <div className="w-40 text-right text-sm">
            <div className="font-medium">{difficultyLabels[difficultyIdx]}</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium">Length</label>
            <input type="range" min={0} max={lengthLabels.length - 1} value={lengthIdx}
              onChange={e => setLengthIdx(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
          <div className="w-40 text-right text-sm">
            <div className="font-medium">{lengthLabels[lengthIdx]}</div>
          </div>
        </div>

        <label className="block">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Additional Requirements</span>
            <span className="text-xs text-gray-500">example: Arrays, Functions, Methods</span>
          </div>
          <textarea value={additional} onChange={e => setAdditional(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-md h-24 dark:bg-gray-700 dark:text-gray-100" placeholder="Optional" />
        </label>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">{progress}</div>
          <div>
            <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {isGenerating ? 'Generating…' : 'Generate Assignments'}
            </button>
          </div>
        </div>

        {assignments.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3">
            {assignments.map((a, idx) => (
              <article key={a.id || idx} className="p-3 border rounded-md bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-start">
                  <div>
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{a.summary}</div>
                    </div>
                  <div className="text-xs text-gray-400">{a.difficulty} • {a.length}</div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/assignments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...a, generatedBy: 'gpt-5-nano', generatedAt: new Date().toISOString() })
                        })
                        if (res.ok) {
                          const saved = await res.json()
                          setAssignments(prev => prev.map(x => x.id === a.id ? saved : x))
                        }
                      } catch (e) {
                        console.error('Save failed', e)
                      }
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  >
                    Save
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
