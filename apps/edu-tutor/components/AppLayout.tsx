'use client'

import { useState } from 'react'
import Chat from '@/components/Chat'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import ModelSelector from '@/components/ModelSelector'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [hintsMode, setHintsMode] = useState(true)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main content area */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <TopBar 
          onSidebarToggle={toggleSidebar} 
          sidebarOpen={sidebarOpen}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          hintsMode={hintsMode}
        />
        
        {/* Model Selector - Mobile */}
        <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model:</span>
            <ModelSelector 
              selectedModel={selectedModel} 
              onModelChange={setSelectedModel}
            />
          </div>
        </div>
        
        {/* Main Chat Area */}
        <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
          <Chat hintsMode={hintsMode} onHintsModeChange={setHintsMode} />
        </div>
      </div>
    </div>
  )
}