'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mode } from '@/types/modes'

interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  currentMode?: Mode
  onModeChange?: (mode: Mode) => void
}

export default function Sidebar({ isOpen = false, onToggle, currentMode = 'Chat', onModeChange }: SidebarProps) {
  const pathname = usePathname()
  const conversations = [
    { id: 1, title: 'Math Problem Help', timestamp: '2 hours ago' },
    { id: 2, title: 'Science Concepts', timestamp: 'Yesterday' },
    { id: 3, title: 'History Discussion', timestamp: '2 days ago' },
  ]

  const modes: Array<{name: Mode, icon: string, description: string, href: string}> = [
    { name: 'Chat', icon: '💬', description: 'AI tutoring with hints', href: '/' },
    { name: 'Curriculum', icon: '📚', description: 'Structured learning plans', href: '/' },
    { name: 'Assignment', icon: '📝', description: 'Hands-on projects', href: '/modes/assignment' },
    { name: 'Assessment', icon: '📊', description: 'Score submissions', href: '/modes/assessment' },
    { name: 'Resources', icon: '🔍', description: 'Find learning materials', href: '/modes/resources' },
  ]

  const getCurrentMode = (): Mode => {
    if (pathname === '/modes/assignment') return 'Assignment'
    if (pathname === '/modes/assessment') return 'Assessment' 
    if (pathname === '/modes/resources') return 'Resources'
    return currentMode
  }

  const effectiveMode = getCurrentMode()

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
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Portfolio AI</h2>
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

        {/* Mode Selection */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Learning Mode</h3>
          <div className="space-y-1">
            {modes.map((mode) => {
              const isActive = effectiveMode === mode.name
              const handleClick = () => {
                if (mode.name === 'Chat' || mode.name === 'Curriculum') {
                  // Use the old mode switching for Chat and Curriculum
                  onModeChange?.(mode.name)
                }
                // For other modes, Link will handle navigation
              }
              
              if (mode.name === 'Chat' || mode.name === 'Curriculum') {
                // Use button for modes handled by AppLayout
                return (
                  <button
                    key={mode.name}
                    onClick={handleClick}
                    className={`w-full text-left p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{mode.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${
                          isActive
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {mode.name}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {mode.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              } else {
                // Use Link for chat mode pages
                return (
                  <Link
                    key={mode.name}
                    href={mode.href}
                    onClick={() => {
                      // Auto-close sidebar on mobile after navigation
                      if (window.innerWidth < 768) {
                        onToggle?.()
                      }
                    }}
                    className={`block w-full text-left p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{mode.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm ${
                          isActive
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {mode.name}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {mode.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              }
            })}
          </div>
        </div>

        {/* Conversations List - Only show for Chat mode */}
        {effectiveMode === 'Chat' && (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <button className="w-full py-2 px-3 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                + New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Conversations</h4>
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
          </>
        )}

        {/* Mode-specific content placeholder */}
        {effectiveMode !== 'Chat' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
              {effectiveMode} mode selected
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <Link href="/settings" id="sidebar-settings" className="w-full block text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              Settings
            </Link>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              Help & FAQ
            </button>
          </div>
        </div>
      </div>
    </>
  )
}