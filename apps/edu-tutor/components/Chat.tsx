'use client'

import { useState, useRef, useCallback } from 'react'
import Toggle from './Toggle'

interface ChatMessage {
  content: string
  isUser: boolean
  timestamp: Date
}

interface StreamingState {
  isStreaming: boolean
  currentContent: string
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [hintsMode, setHintsMode] = useState(true)
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentContent: ''
  })
  const [lastUserMessage, setLastUserMessage] = useState('')
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  const addMessage = useCallback((content: string, isUser: boolean) => {
    setMessages(prev => [...prev, { content, isUser, timestamp: new Date() }])
    setTimeout(scrollToBottom, 100)
  }, [scrollToBottom])
  
  const handleSubmit = useCallback(async (message: string, mode: 'hints' | 'solution') => {
    if (!message.trim() || streamingState.isStreaming) return
    
    // Add user message
    addMessage(message, true)
    setLastUserMessage(message)
    
    // Clear input if it's a new message (not "Show Solution")
    if (mode === 'hints' || message !== lastUserMessage) {
      setInputValue('')
    }
    
    // Start streaming
    setStreamingState({ isStreaming: true, currentContent: '' })
    
    try {
      abortControllerRef.current = new AbortController()
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, mode }),
        signal: abortControllerRef.current.signal
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No response body')
      }
      
      let accumulatedContent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (jsonStr === '') continue
            
            try {
              const data = JSON.parse(jsonStr)
              
              if (data.error) {
                throw new Error(data.error)
              }
              
              if (data.delta) {
                accumulatedContent += data.delta
                setStreamingState(prev => ({
                  ...prev,
                  currentContent: accumulatedContent
                }))
              }
              
              if (data.done) {
                // Finalize the message
                addMessage(accumulatedContent, false)
                setStreamingState({ isStreaming: false, currentContent: '' })
                return
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError)
            }
          }
        }
      }
    } catch (error: unknown) {
      console.error('Chat error:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        setStreamingState({ isStreaming: false, currentContent: '' })
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.'
      addMessage(`Error: ${errorMessage}`, false)
      setStreamingState({ isStreaming: false, currentContent: '' })
    }
  }, [streamingState.isStreaming, addMessage, lastUserMessage])
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inputValue.trim()) {
      handleSubmit(inputValue.trim(), hintsMode ? 'hints' : 'solution')
    }
  }
  
  const handleShowSolution = () => {
    if (lastUserMessage && !streamingState.isStreaming) {
      handleSubmit(lastUserMessage, 'solution')
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFormSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }
  
  const exportSession = () => {
    const sessionText = messages
      .map(msg => `${msg.isUser ? 'You' : 'Tutor'}: ${msg.content}`)
      .join('\n\n')
    
    const blob = new Blob([sessionText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tutoring-session-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  const copySession = () => {
    const sessionText = messages
      .map(msg => `${msg.isUser ? 'You' : 'Tutor'}: ${msg.content}`)
      .join('\n\n')
    
    navigator.clipboard.writeText(sessionText).then(() => {
      alert('Session content copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy to clipboard')
    })
  }
  
  return (
    <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="mb-4 pb-4 border-b">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Educational Tutor
          </h1>
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              checked={hintsMode}
              onChange={setHintsMode}
              label="Hints mode"
              disabled={streamingState.isStreaming}
            />
            {lastUserMessage && !hintsMode && (
              <button
                onClick={handleShowSolution}
                disabled={streamingState.isStreaming}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Show Solution
              </button>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {messages.length === 0 && !streamingState.isStreaming && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="text-lg mb-2">Welcome to your AI tutor!</p>
              <p className="text-sm">
                Ask any educational question. Toggle &quot;Hints mode&quot; to get guidance instead of direct answers.
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] p-3 rounded-lg whitespace-pre-wrap
                  ${message.isUser
                    ? 'bg-blue-600 text-white ml-4'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-4'
                  }
                `}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {/* Streaming message */}
          {streamingState.isStreaming && (
            <div className="flex justify-start">
              <div 
                className="max-w-[80%] p-3 rounded-lg whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-4"
                aria-live="polite"
                aria-label="AI response streaming"
              >
                {streamingState.currentContent}
                <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" aria-hidden="true">|</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Status line */}
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 min-h-[1.25rem]">
          {streamingState.isStreaming ? 'Streaming...' : messages.length > 0 ? 'Done' : ''}
        </div>
        
        {/* Input form */}
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div>
            <label htmlFor="question-input" className="sr-only">
              Ask your educational question
            </label>
            <textarea
              ref={textareaRef}
              id="question-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your educational question here... (Press Enter to send, Shift+Enter for new line)"
              disabled={streamingState.isStreaming}
              rows={3}
              maxLength={1500}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            />
            <div className="text-xs text-gray-500 mt-1">
              {inputValue.length}/1500 characters
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-between">
            <button
              type="submit"
              disabled={!inputValue.trim() || streamingState.isStreaming}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {streamingState.isStreaming ? 'Processing...' : 'Send'}
            </button>
            
            {messages.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copySession}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Copy Session
                </button>
                <button
                  type="button"
                  onClick={exportSession}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Export Session
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}