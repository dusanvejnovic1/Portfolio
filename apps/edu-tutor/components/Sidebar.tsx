'use client'

interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
}

export default function Sidebar({ isOpen = false, onToggle }: SidebarProps) {
  const conversations = [
    { id: 1, title: 'Math Problem Help', timestamp: '2 hours ago' },
    { id: 2, title: 'Science Concepts', timestamp: 'Yesterday' },
    { id: 3, title: 'History Discussion', timestamp: '2 days ago' },
  ]

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-40 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Open sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    )
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
        onClick={onToggle}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversations</h2>
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button className="w-full py-2 px-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            + New Chat
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className="w-full text-left p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 group"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                  {conversation.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {conversation.timestamp}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              Settings
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              Help & FAQ
            </button>
          </div>
        </div>
      </div>
    </>
  )
}