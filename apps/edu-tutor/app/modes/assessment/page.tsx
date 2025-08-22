import Link from 'next/link'
import ChatMode from '@/components/ChatMode'
import { IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'

export default function AssessmentChatPage() {
  const systemPrompt = `${IT_TUTOR_SYSTEM_PROMPT}

You are in Assessment mode. Ask targeted questions and provide feedback. Help with:
- Creating assessment criteria
- Evaluating work and projects
- Providing constructive feedback
- Suggesting improvements
- Designing evaluation rubrics

Focus on fair, comprehensive evaluation that supports learning and growth.`

  return (
    <div>
      <div className="max-w-3xl mx-auto p-6 pb-2">
        <div className="flex items-center gap-4 mb-6">
          <Link 
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            ← Back to Main
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Assessment Mode
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get help with evaluations, feedback, and assessment criteria for learning.
        </p>
      </div>
      <ChatMode systemPrompt={systemPrompt} />
    </div>
  )
}