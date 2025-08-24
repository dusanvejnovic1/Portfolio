'use client'

import { useState, useEffect } from 'react'

interface FullScreenLoaderProps {
  title: string
  subtitle?: string
  progress?: number // 0-1
  onCancel?: () => void
  showCancel?: boolean
}

export function FullScreenLoader({ 
  title, 
  subtitle, 
  progress, 
  onCancel, 
  showCancel = true 
}: FullScreenLoaderProps) {
  const [dots, setDots] = useState('.')

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '.'
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const progressPercent = progress ? Math.round(progress * 100) : 0

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground">
              {subtitle}{dots}
            </p>
          )}
        </div>

        {/* Progress section */}
        <div className="mb-6">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-3 mb-3">
            <div 
              className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          {/* Progress text */}
          {progress !== undefined && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
          )}
        </div>

        {/* Loading animation */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-primary rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        </div>

        {/* Cancel button */}
        {showCancel && onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default FullScreenLoader

