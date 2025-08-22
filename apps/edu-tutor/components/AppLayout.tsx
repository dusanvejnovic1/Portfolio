'use client'

import { useState } from 'react'
import Chat from '@/components/Chat'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import ModelSelector from '@/components/ModelSelector'
import CurriculumMode from '@/components/modes/CurriculumMode'
import AssignmentMode from '@/components/modes/AssignmentMode'
import AssessmentMode from '@/components/modes/AssessmentMode'
import ResourcesMode from '@/components/modes/ResourcesMode'
import { Mode } from '@/types/modes'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini')
  const [hintsMode, setHintsMode] = useState(false)
  const [currentMode, setCurrentMode] = useState<Mode>('Chat')

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const handleModeChange = (mode: Mode) => {
    setCurrentMode(mode)
    // Auto-close sidebar on mobile after mode selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const renderMainContent = () => {
    switch (currentMode) {
      case 'Chat':
        return (
          <Chat 
            hintsMode={hintsMode} 
            onHintsModeChange={setHintsMode} 
            selectedModel={selectedModel}
          />
        )
      case 'Curriculum':
        return <CurriculumMode />
      case 'Assignment':
        return <AssignmentMode />
      case 'Assessment':
        return <AssessmentMode />
      case 'Resources':
        return <ResourcesMode />
      default:
        return (
          <Chat 
            hintsMode={hintsMode} 
            onHintsModeChange={setHintsMode} 
            selectedModel={selectedModel}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar}
        currentMode={currentMode}
        onModeChange={handleModeChange}
      />
      
      {/* Main content area */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        {/* Top Bar - Only show for Chat mode */}
        {currentMode === 'Chat' && (
          <>
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
          </>
        )}
        
        {/* Main Content Area */}
        <div className={currentMode === 'Chat' ? 'h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]' : 'min-h-screen'}>
          {renderMainContent()}
        </div>
      </div>
    </div>
  )
}
