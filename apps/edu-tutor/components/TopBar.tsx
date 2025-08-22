'use client'

import ModelSelector from './ModelSelector'

interface TopBarProps {
  onSidebarToggle?: () => void
  sidebarOpen?: boolean
  selectedModel?: string
  onModelChange?: (model: string) => void
  hintsMode?: boolean
}

export default function TopBar({ 
  onSidebarToggle, 
  sidebarOpen,
  selectedModel = 'gpt-5-mini',
  onModelChange,
  hintsMode = true
}: TopBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {/* Sidebar toggle - only show when sidebar is closed */}
          {!sidebarOpen && (
            <button
              onClick={onSidebarToggle}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          
          {/* App Title */}
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Portfolio AI
          </h1>
        </div>

        {/* Center - Model Selector */}
        <div className="hidden md:block">
          <ModelSelector 
            selectedModel={selectedModel}
            onModelChange={onModelChange}
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Mode indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className={`w-2 h-2 rounded-full ${hintsMode ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              {hintsMode ? 'Hints Mode' : 'Solution Mode'}
            </span>
          </div>

          {/* Menu button */}
          <div className="relative">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}