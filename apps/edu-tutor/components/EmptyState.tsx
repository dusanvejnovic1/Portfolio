'use client'

interface EmptyStateProps {
  title?: string
  description?: string
  actionText?: string
  onAction?: () => void
  icon?: 'chat' | 'image' | 'search' | 'book'
}

export default function EmptyState({ 
  title = "Welcome to your AI tutor!",
  description = "Ask any educational question or upload an image for analysis. Toggle 'Hints mode' to get guidance instead of direct answers.",
  actionText,
  onAction,
  icon = 'chat'
}: EmptyStateProps) {
  const getIcon = () => {
    switch (icon) {
      case 'image':
        return (
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'search':
        return (
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )
      case 'book':
        return (
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )
      default: // chat
        return (
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center">
      <div className="mb-6">
        {getIcon()}
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {title}
      </h2>
      
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      
      {/* Example prompts */}
      <div className="grid gap-3 max-w-2xl mx-auto mb-8">
        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">
          Try asking:
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              &quot;Explain photosynthesis&quot;
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Get step-by-step explanations
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Upload a math problem
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Get image analysis and hints
            </div>
          </div>
        </div>
      </div>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {actionText}
        </button>
      )}
      
      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-2 mt-8 text-xs">
        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full">
          JPEG & PNG Support
        </span>
        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full">
          Up to 500MB
        </span>
        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 rounded-full">
          AI-Powered Analysis
        </span>
      </div>
    </div>
  )
}