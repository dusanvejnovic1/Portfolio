'use client'

import React, { useState, useRef, useCallback } from 'react'
import Toggle from './Toggle'
import ImageUpload from './ImageUpload'
import EmptyState from './EmptyState'
import { TypingIndicator } from './SkeletonLoader'

interface ChatMessage {
  content: string
  isUser: boolean
  timestamp: Date
  hasImage?: boolean
}

interface StreamingState {
  isStreaming: boolean
  currentContent: string
}

interface ChatProps {
  hintsMode?: boolean
  onHintsModeChange?: (mode: boolean) => void
  selectedModel?: string
}

export default function Chat({ hintsMode: propHintsMode = true, onHintsModeChange, selectedModel }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [hintsMode, setHintsMode] = useState(propHintsMode)
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentContent: ''
  })
  const [lastUserMessage, setLastUserMessage] = useState('')
  const [currentImage, setCurrentImage] = useState<File | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Sync with prop changes
  React.useEffect(() => {
    setHintsMode(propHintsMode)
  }, [propHintsMode])
  
  // Notify parent of hints mode changes
  const handleHintsModeChange = (mode: boolean) => {
    setHintsMode(mode)
    onHintsModeChange?.(mode)
  }
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  const addMessage = useCallback((content: string, isUser: boolean, hasImage: boolean = false) => {
    setMessages(prev => [...prev, { content, isUser, timestamp: new Date(), hasImage }])
    setTimeout(scrollToBottom, 100)
  }, [scrollToBottom])
  
  const handleSubmit = useCallback(async (message: string, mode: 'hints' | 'solution', image?: File) => {
    if ((!message.trim() && !image) || streamingState.isStreaming) return
    
    // Add user message
    const messageText = image 
      ? (message.trim() ? `${message} [Image uploaded]` : '[Image uploaded]')
      : message
    addMessage(messageText, true, !!image)
    setLastUserMessage(message)
    
    // Clear input and image if it's a new message (not "Show Solution")
    if (mode === 'hints' || message !== lastUserMessage) {
      setInputValue('')
      setCurrentImage(null)
    }
    
    // Start streaming
    setStreamingState({ isStreaming: true, currentContent: '' })
    
    try {
      abortControllerRef.current = new AbortController()
      
      let response: Response
      
      if (image) {
        // Use vision API for image analysis
        const formData = new FormData()
        if (message.trim()) {
          formData.append('prompt', message)
        }
        formData.append('mode', mode)
        if (selectedModel) {
          formData.append('model', selectedModel)
        }
        formData.append('image', image)
        
        response = await fetch('/api/vision', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal
        })
      } else {
        // Use regular chat API for text-only
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, mode, model: selectedModel }),
          signal: abortControllerRef.current.signal
        })
      }
      
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to get response'
        const errorCode = errorData.code || 'unknown_error'
        
        // Handle different error types
        if (errorCode === 'moderated') {
          // Show the educational safety message for moderated content
          addMessage(errorMessage, false)
        } else {
          // For other errors, show as an error message with code for debugging
          console.error('Chat API error:', { code: errorCode, message: errorMessage })
          addMessage(`Error (${errorCode}): ${errorMessage}`, false)
        }
        
        setStreamingState({ isStreaming: false, currentContent: '' })
        return
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
                const errorCode = data.code || 'unknown_error'
                const errorMessage = data.error
                
                // Handle different error types in streaming
                if (errorCode === 'moderated') {
                  // Show educational safety message for moderated content
                  addMessage(errorMessage, false)
                } else {
                  // Show error with code for debugging
                  console.error('Streaming error:', { code: errorCode, message: errorMessage })
                  addMessage(`Error (${errorCode}): ${errorMessage}`, false)
                }
                
                setStreamingState({ isStreaming: false, currentContent: '' })
                return
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
  }, [streamingState.isStreaming, addMessage, lastUserMessage, selectedModel])
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (inputValue.trim() || currentImage) {
      handleSubmit(inputValue.trim(), hintsMode ? 'hints' : 'solution', currentImage || undefined)
    }
  }
  
  const handleShowSolution = () => {
    if (lastUserMessage && !streamingState.isStreaming) {
      handleSubmit(lastUserMessage, 'solution', currentImage || undefined)
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              checked={hintsMode}
              onChange={handleHintsModeChange}
              label="Hints mode"
              disabled={streamingState.isStreaming}
            />
            {process.env.NEXT_PUBLIC_FEATURE_DIAGNOSTICS === 'true' && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/diagnostics/openai')
                    const result = await response.json()
                    const message = result.ok 
                      ? `✅ OpenAI connection successful (${result.provider_latency_ms}ms)`
                      : `❌ OpenAI connection failed: ${result.error}`
                    alert(message)
                  } catch (err) {
                    console.error('Diagnostic test failed:', err)
                    alert('❌ Diagnostic test failed')
                  }
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
                disabled={streamingState.isStreaming}
              >
                Test OpenAI
              </button>
            )}
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
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !streamingState.isStreaming ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[85%] p-4 rounded-lg whitespace-pre-wrap
                      ${message.isUser
                        ? 'bg-blue-600 text-white ml-4'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-4'
                      }
                    `}
                  >
                    {message.content}
                    {message.hasImage && (
                      <div className="mt-2 text-xs opacity-75">
                        📎 Image attached
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Streaming message */}
              {streamingState.isStreaming && (
                <div className="flex justify-start">
                  <div 
                    className="max-w-[85%] p-4 rounded-lg whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-4"
                    aria-live="polite"
                    aria-label="AI response streaming"
                  >
                    {streamingState.currentContent || <TypingIndicator />}
                    {streamingState.currentContent && (
                      <span className="inline-block w-2 h-5 bg-gray-400 ml-1 animate-pulse" aria-hidden="true">|</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Status line */}
        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {streamingState.isStreaming ? 'AI is analyzing...' : messages.length > 0 ? 'Ready for your next question' : 'Ready to help with your studies'}
        </div>
        
        {/* Input form */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
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
            
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload Image (Optional)
              </label>
              <ImageUpload
                currentImage={currentImage}
                onImageChange={setCurrentImage}
                disabled={streamingState.isStreaming}
              />
            </div>
            
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <button
                type="submit"
                disabled={(!inputValue.trim() && !currentImage) || streamingState.isStreaming}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
              >
                {streamingState.isStreaming ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Send'
                )}
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
    </div>
  )
}