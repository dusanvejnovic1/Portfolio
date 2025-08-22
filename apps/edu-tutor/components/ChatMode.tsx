'use client'
import { useState, useRef } from 'react'
import { fetchNDJSONStream } from '@/lib/sse'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatMode({ systemPrompt }: { systemPrompt: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bufferRef = useRef('')

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text) return

    const newMsgs: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    const assistantIndex = newMsgs.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      await fetchNDJSONStream('/api/modes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, messages: newMsgs }),
        onMessage: (m: unknown) => {
          if (typeof m === 'object' && m !== null && 'type' in m) {
            const msg = m as { type: string; content?: string }
            if (msg?.type === 'delta' && typeof msg.content === 'string') {
              bufferRef.current += msg.content
              setMessages(prev => prev.map((message, idx) => 
                idx === assistantIndex ? { ...message, content: bufferRef.current } : message
              ))
            }
          }
        },
        onComplete: () => {
          bufferRef.current = ''
          setLoading(false)
        },
        onError: () => {
          bufferRef.current = ''
          setLoading(false)
        }
      })
    } catch {
      bufferRef.current = ''
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="space-y-4 mb-4 min-h-[400px]">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={m.role === 'user' 
              ? 'inline-block bg-blue-600 text-white px-3 py-2 rounded-lg max-w-[80%]' 
              : 'inline-block bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap'
            }>
              {m.content}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-16">
            <p>Start a conversation by typing your question below.</p>
          </div>
        )}
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}