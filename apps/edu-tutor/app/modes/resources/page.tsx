'use client'
import { useEffect, useState } from 'react'
import ChatMode from '@/components/ChatMode'
import { IT_TUTOR_SYSTEM_PROMPT } from '@/lib/prompts'

export default function ResourcesChatPage() {
  const [keys, setKeys] = useState<{ bing: boolean; youtube: boolean } | null>(null)
  
  useEffect(() => {
    fetch('/api/modes/resources/config')
      .then(r => r.json())
      .then(setKeys)
      .catch(() => setKeys({ bing: false, youtube: false }))
  }, [])

  const systemPrompt = `${IT_TUTOR_SYSTEM_PROMPT}

You are in Resources mode. When suggesting links, prefer official docs and high-quality sources. Help with:
- Finding relevant learning materials
- Recommending documentation and tutorials  
- Suggesting tools and platforms
- Identifying quality educational content
- Providing context for resources

Do not fabricate URLs. Focus on well-known, reputable sources.`

  return (
    <div>
      <div className="max-w-3xl mx-auto p-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Resources Mode
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Discover learning materials, documentation, and educational resources for your topics.
        </p>
      </div>
      
      {keys && (!keys.bing || !keys.youtube) && (
        <div className="mx-auto max-w-3xl p-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-md m-4 text-sm">
          Some integrations are not configured: 
          {!keys.bing && ' Bing Search'} 
          {!keys.bing && !keys.youtube && ' and'} 
          {!keys.youtube && ' YouTube API'}. 
          The chat will still work but results may be limited.
        </div>
      )}
      
      <ChatMode systemPrompt={systemPrompt} />
    </div>
  )
}