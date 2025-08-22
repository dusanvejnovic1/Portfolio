'use client'

import { useState } from 'react'
import { 
  AssessmentResult, 
  AssessmentScoreRequest
} from '@/types/modes'

export default function AssessmentMode() {
  const [formData, setFormData] = useState<Partial<AssessmentScoreRequest>>({
    assignmentText: '',
    submissionTextOrLink: ''
  })
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.assignmentText || !formData.submissionTextOrLink) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/modes/assessment/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const data = await response.json()
        setResult(data)
      }
    } catch (error) {
      console.error('Failed to score submission:', error)
    }
    setIsLoading(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600 dark:text-green-400'
    if (score >= 3.5) return 'text-blue-600 dark:text-blue-400'
    if (score >= 2.5) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 1.5) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBackground = (score: number) => {
    if (score >= 4.5) return 'bg-green-100 dark:bg-green-900/30'
    if (score >= 3.5) return 'bg-blue-100 dark:bg-blue-900/30'
    if (score >= 2.5) return 'bg-yellow-100 dark:bg-yellow-900/30'
    if (score >= 1.5) return 'bg-orange-100 dark:bg-orange-900/30'
    return 'bg-red-100 dark:bg-red-900/30'
  }

  const exportAssessment = () => {
    if (!result) return

    const content = `# Assessment Results

## Overall Score: ${result.overallScore}/5

## Summary
${result.summary}

## What Was Done Well
${result.whatWasGood.map(item => `- ${item}`).join('\n')}

## Areas for Improvement
${result.needsImprovement.map(item => `- ${item}`).join('\n')}

## Critical Issues to Fix
${result.mustFix.map(item => `- ${item}`).join('\n')}

## Next Steps
${result.nextSteps.map(step => `- ${step}`).join('\n')}

## Detailed Rubric Breakdown

${result.rubricBreakdown.map(item => `
### ${item.criterion}
**Score:** ${item.score}/5

**Evidence:** ${item.evidence}

**Feedback:** ${item.feedback}
`).join('\n')}
`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assessment-results-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Assessment & Scoring
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assignment Description/Requirements
              </label>
              <textarea
                value={formData.assignmentText || ''}
                onChange={(e) => setFormData({...formData, assignmentText: e.target.value})}
                placeholder="Paste the assignment instructions, requirements, or rubric here..."
                className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Submission
              </label>
              <textarea
                value={formData.submissionTextOrLink || ''}
                onChange={(e) => setFormData({...formData, submissionTextOrLink: e.target.value})}
                placeholder="Paste the student's submission text or provide a link to their work (GitHub repo, portfolio, etc.)"
                className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 resize-none"
                required
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Can be text, code, or links to repositories/portfolios
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Analyzing Submission...' : 'Score Submission'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className={`p-6 rounded-lg border-2 ${getScoreBackground(result.overallScore)}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Overall Score
                  </h3>
                  <button
                    onClick={exportAssessment}
                    className="py-1 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
                  >
                    📄 Export
                  </button>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>
                  {result.overallScore}/5
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Assessment Summary
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {result.summary}
                </p>
              </div>

              {/* Strengths */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  ✅ Strengths
                </h3>
                <ul className="space-y-2">
                  {result.whatWasGood.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span className="text-gray-600 dark:text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              {result.needsImprovement.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    📈 Areas for Improvement
                  </h3>
                  <ul className="space-y-2">
                    {result.needsImprovement.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        <span className="text-gray-600 dark:text-gray-400">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Critical Issues */}
              {result.mustFix.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    🚨 Critical Issues
                  </h3>
                  <ul className="space-y-2">
                    {result.mustFix.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span className="text-gray-600 dark:text-gray-400">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  🎯 Recommended Next Steps
                </h3>
                <ol className="space-y-2">
                  {result.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-3 font-medium">{index + 1}.</span>
                      <span className="text-gray-600 dark:text-gray-400">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Rubric Breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  📋 Detailed Rubric Breakdown
                </h3>
                <div className="space-y-4">
                  {result.rubricBreakdown.map((item, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {item.criterion}
                        </h4>
                        <span className={`font-bold ${getScoreColor(item.score)}`}>
                          {item.score}/5
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Evidence:</span>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">{item.evidence}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Feedback:</span>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">{item.feedback}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}