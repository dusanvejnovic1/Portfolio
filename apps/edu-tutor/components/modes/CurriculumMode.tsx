'use client'

import { useState } from 'react'
import { 
  CurriculumPlan, 
  CurriculumWeek,
  CurriculumDay,
  CurriculumOutlineRequest, 
  CurriculumGenerateRequest,
  LearningLevel 
} from '@/types/modes'

export default function CurriculumMode() {
  const [step, setStep] = useState<'setup' | 'outline' | 'generate' | 'view'>('setup')
  const [formData, setFormData] = useState<Partial<CurriculumOutlineRequest>>({
    topic: '',
    level: 'Beginner',
    durationDays: 30
  })
  const [currentPlan, setCurrentPlan] = useState<CurriculumPlan | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [outline, setOutline] = useState<CurriculumWeek[] | null>(null)

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.topic) return

    setIsLoading(true)
    try {
      // Generate outline first
      const outlineResponse = await fetch('/api/modes/curriculum/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (outlineResponse.ok) {
        const outlineData = await outlineResponse.json()
        setOutline(outlineData.outline)
        setStep('outline')
      }
    } catch (error) {
      console.error('Failed to generate outline:', error)
    }
    setIsLoading(false)
  }

  const handleGeneratePlan = async () => {
    if (!formData.topic || !outline) return

    setIsLoading(true)
    setStep('generate')

    try {
      const generateRequest: CurriculumGenerateRequest = {
        topic: formData.topic!,
        level: formData.level!,
        durationDays: formData.durationDays!,
        batch: {
          startDay: 1,
          endDay: Math.min(7, formData.durationDays!) // Start with first week
        },
        outline
      }

      const response = await fetch('/api/modes/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateRequest)
      })

      if (response.ok && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const days: CurriculumDay[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              if (data.type === 'day' && data.day) {
                days.push(data.day)
              }
            } catch (e) {
              console.warn('Failed to parse streaming response:', e)
            }
          }
        }

        const plan: CurriculumPlan = {
          topic: formData.topic!,
          level: formData.level!,
          durationDays: formData.durationDays!,
          outline,
          days
        }

        setCurrentPlan(plan)
        setStep('view')
      }
    } catch (error) {
      console.error('Failed to generate curriculum:', error)
    }
    setIsLoading(false)
  }

  const exportMarkdown = async () => {
    if (!currentPlan) return

    try {
      const exportLib = await import('@/lib/export/markdown')
      const markdown = exportLib.exportCurriculumToMarkdown(currentPlan)
      
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentPlan.topic.replace(/\s+/g, '-')}-curriculum.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export markdown:', error)
    }
  }

  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Create Learning Curriculum
        </h2>
        
        <form onSubmit={handleSetupSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What do you want to learn?
            </label>
            <input
              type="text"
              value={formData.topic || ''}
              onChange={(e) => setFormData({...formData, topic: e.target.value})}
              placeholder="e.g., Docker containerization, Python web development, AWS cloud basics"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Level
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value as LearningLevel})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Duration (days)
            </label>
            <input
              type="number"
              min="7"
              max="60"
              value={formData.durationDays}
              onChange={(e) => setFormData({...formData, durationDays: parseInt(e.target.value)})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Recommended: 7-30 days for focused topics, 30-60 days for comprehensive learning
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating Outline...' : 'Generate Curriculum Outline'}
          </button>
        </form>
      </div>
    )
  }

  if (step === 'outline') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Curriculum Outline: {formData.topic}
          </h2>
          <button
            onClick={() => setStep('setup')}
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Back to Setup
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <div>Level: <span className="font-medium text-gray-900 dark:text-gray-100">{formData.level}</span></div>
            <div>Duration: <span className="font-medium text-gray-900 dark:text-gray-100">{formData.durationDays} days</span></div>
            <div>Weeks: <span className="font-medium text-gray-900 dark:text-gray-100">{Math.ceil(formData.durationDays! / 7)}</span></div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {outline?.map((week: CurriculumWeek, index: number) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Week {week.week}: {week.focus}
              </h3>
              {week.notes && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">{week.notes}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGeneratePlan}
            disabled={isLoading}
            className="py-3 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Detailed Plan'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'generate') {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Generating Your Curriculum
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Creating detailed daily lessons with hands-on activities...
        </p>
      </div>
    )
  }

  if (step === 'view' && currentPlan) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currentPlan.topic} - {currentPlan.level} Level
          </h2>
          <div className="flex gap-2">
            <button
              onClick={exportMarkdown}
              className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
            >
              📄 Export MD
            </button>
            <button
              onClick={() => setStep('setup')}
              className="py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm"
            >
              Create New
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Day Selector */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Days</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentPlan.days.map((day, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    Day {day.day}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {day.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Day Content */}
          <div className="lg:col-span-3">
            {currentPlan.days.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Day {currentPlan.days[0].day}: {currentPlan.days[0].title}
                </h3>
                
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {currentPlan.days[0].summary}
                  </p>
                  
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Goals</h4>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    {currentPlan.days[0].goals.map((goal, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{goal}</li>
                    ))}
                  </ul>

                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Theory</h4>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    {currentPlan.days[0].theorySteps.map((step, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{step}</li>
                    ))}
                  </ul>

                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Hands-On Practice</h4>
                  <ul className="list-disc list-inside space-y-1 mb-4">
                    {currentPlan.days[0].handsOnSteps.map((step, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{step}</li>
                    ))}
                  </ul>

                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Assignment</h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {currentPlan.days[0].assignment}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}