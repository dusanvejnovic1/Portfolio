import ChatMode from '@/components/ChatMode'
import { IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'

export default function AssignmentChatPage() {
  const systemPrompt = `${IT_TUTOR_SYSTEM_PROMPT}

You are in Assignment mode. Be concise and practical. Help students with:
- Creating practical assignments
- Understanding requirements
- Breaking down complex tasks
- Providing guidance on deliverables
- Suggesting evaluation criteria

Focus on real-world applications and hands-on learning experiences.`

  return (
    <div>
      <div className="max-w-3xl mx-auto p-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Assignment Mode
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Get help creating, understanding, and working with assignments and practical tasks.
        </p>
      </div>
      <ChatMode systemPrompt={systemPrompt} />
    </div>
  )
}