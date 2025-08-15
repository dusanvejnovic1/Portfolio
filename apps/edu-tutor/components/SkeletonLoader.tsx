'use client'

interface SkeletonLoaderProps {
  type?: 'message' | 'list' | 'card' | 'image'
  count?: number
}

export default function SkeletonLoader({ type = 'message', count = 1 }: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'message':
        return (
          <div className="flex justify-start mb-4">
            <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 dark:bg-gray-800 mr-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        )
      
      case 'list':
        return (
          <div className="p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )
      
      case 'card':
        return (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="space-y-3">
              <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
              </div>
            </div>
          </div>
        )
      
      case 'image':
        return (
          <div className="relative animate-pulse">
            <div className="bg-gray-300 dark:bg-gray-600 rounded-md aspect-video w-full"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  )
}

// Specialized skeleton components for common use cases
export function MessageSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="message" count={count} />
}

export function ConversationListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonLoader type="list" count={count} />
    </div>
  )
}

export function LoadingDots() {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg mr-4">
        <LoadingDots />
        <span className="text-sm text-gray-500 dark:text-gray-400">AI is typing...</span>
      </div>
    </div>
  )
}