'use client'

import { useState } from 'react'
import { 
  AssignmentSet, 
  AssignmentVariant,
  AssignmentGenerateRequest, 
  LearningLevel,
  GuidanceStyle 
} from '@/types/modes'

export default function AssignmentMode() {
  const [step, setStep] = useState<'setup' | 'view'>('setup')
  const [formData, setFormData] = useState<Partial<AssignmentGenerateRequest>>({
    topic: '',
    difficulty: 'Beginner',
    timeBudgetHrs: 4,
    guidanceStyle: 'hints'
  })
  const [currentSet, setCurrentSet] = useState<AssignmentSet | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.topic) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/modes/assignment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const data = await response.json()
        const assignmentSet: AssignmentSet = {
          topic: formData.topic!,
          difficulty: formData.difficulty!,
          variants: data.set,
          timeBudgetHrs: formData.timeBudgetHrs
        }
        setCurrentSet(assignmentSet)
        setSelectedVariant(data.set[0]?.id || null)
        setStep('view')
      }
    } catch (error) {
      console.error('Failed to generate assignments:', error)
    }
    setIsLoading(false)
  }

  const exportAssignment = (variant: AssignmentVariant) => {
    const content = `# ${variant.title}

## Scenario
${variant.scenario}

## Learning Objectives
${variant.objectives.map(obj => `- ${obj}`).join('\n')}

## Steps to Complete
${variant.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Deliverables
${variant.deliverables.map(del => `- ${del}`).join('\n')}

## Assessment Rubric
${variant.rubric.map(criterion => `
### ${criterion.name} (Weight: ${Math.round(criterion.weight * 100)}%)
${criterion.description}

**Scoring:**
${criterion.levels.map(level => `- **${level.score}/5**: ${level.description}`).join('\n')}
`).join('\n')}

${variant.hints && variant.hints.length > 0 ? `
## Hints
${variant.hints.map(hint => `- ${hint}`).join('\n')}
` : ''}

${variant.stretchGoals && variant.stretchGoals.length > 0 ? `
## Stretch Goals (Optional)
${variant.stretchGoals.map(goal => `- ${goal}`).join('\n')}
` : ''}
`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${variant.title.replace(/\s+/g, '-')}-assignment.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Generate IT Assignments
        </h2>
        
        <form onSubmit={handleSetupSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assignment Topic
            </label>
            <input
              type="text"
              value={formData.topic || ''}
              onChange={(e) => setFormData({...formData, topic: e.target.value})}
              placeholder="e.g., Docker deployment, API development, Database design"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Difficulty Level
            </label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({...formData, difficulty: e.target.value as LearningLevel})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Budget (hours)
            </label>
            <input
              type="number"
              min="1"
              max="40"
              value={formData.timeBudgetHrs}
              onChange={(e) => setFormData({...formData, timeBudgetHrs: parseInt(e.target.value)})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Guidance Style
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="hints"
                  checked={formData.guidanceStyle === 'hints'}
                  onChange={(e) => setFormData({...formData, guidanceStyle: e.target.value as GuidanceStyle})}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Hints & Scaffolding</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="solutions"
                  checked={formData.guidanceStyle === 'solutions'}
                  onChange={(e) => setFormData({...formData, guidanceStyle: e.target.value as GuidanceStyle})}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">With Solutions</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating Assignments...' : 'Generate 3 Assignment Variants'}
          </button>
        </form>
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
                  onClick={() => setSelectedVariant(variant.id)}
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
                    {variant.title.substring(0, 50)}...
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
                  {selectedAssignment.title}
                </h3>
                <button
                  onClick={() => exportAssignment(selectedAssignment)}
                  className="py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm"
                >
                  📄 Export
                </button>
              </div>
              
              <div className="prose dark:prose-invert max-w-none">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Scenario</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {selectedAssignment.scenario}
                </p>
                
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Learning Objectives</h4>
                <ul className="list-disc list-inside space-y-1 mb-6">
                  {selectedAssignment.objectives.map((objective, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-400">{objective}</li>
                  ))}
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Steps to Complete</h4>
                <ol className="list-decimal list-inside space-y-2 mb-6">
                  {selectedAssignment.steps.map((step, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-400">{step}</li>
                  ))}
                </ol>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Deliverables</h4>
                <ul className="list-disc list-inside space-y-1 mb-6">
                  {selectedAssignment.deliverables.map((deliverable, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-400">{deliverable}</li>
                  ))}
                </ul>

                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Assessment Rubric</h4>
                <div className="space-y-4 mb-6">
                  {selectedAssignment.rubric.map((criterion, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {criterion.name} <span className="text-sm text-gray-500">({Math.round(criterion.weight * 100)}%)</span>
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{criterion.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {criterion.levels.map((level, levelIndex) => (
                          <div key={levelIndex} className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              Score: {level.score}/5
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {level.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedAssignment.hints && selectedAssignment.hints.length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Hints</h4>
                    <ul className="list-disc list-inside space-y-1 mb-6">
                      {selectedAssignment.hints.map((hint, index) => (
                        <li key={index} className="text-gray-600 dark:text-gray-400">{hint}</li>
                      ))}
                    </ul>
                  </>
                )}

                {selectedAssignment.stretchGoals && selectedAssignment.stretchGoals.length > 0 && (
                  <>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Stretch Goals (Optional)</h4>
                    <ul className="list-disc list-inside space-y-1 mb-6">
                      {selectedAssignment.stretchGoals.map((goal, index) => (
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