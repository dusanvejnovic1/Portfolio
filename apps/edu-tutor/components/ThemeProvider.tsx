"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  isLoading: true
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    const initializeTheme = () => {
      try {
        const saved = localStorage.getItem('theme') as Theme | null
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        
        let initialTheme: Theme = 'dark'
        
        if (saved === 'light' || saved === 'dark') {
          initialTheme = saved
        } else if (prefersDark) {
          initialTheme = 'dark'
        } else {
          initialTheme = 'light'
        }

        setThemeState(initialTheme)
        applyTheme(initialTheme)
        
        // Save to localStorage if not already set
        if (!saved) {
          localStorage.setItem('theme', initialTheme)
        }
      } catch (e) {
        console.warn('ThemeProvider: failed to access localStorage', e)
        // Fall back to system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const fallbackTheme: Theme = prefersDark ? 'dark' : 'light'
        setThemeState(fallbackTheme)
        applyTheme(fallbackTheme)
      } finally {
        setIsLoading(false)
      }
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme: Theme = e.matches ? 'dark' : 'light'
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem('theme')) {
        setThemeState(newTheme)
        applyTheme(newTheme)
        localStorage.setItem('theme', newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    initializeTheme()

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const applyTheme = (newTheme: Theme) => {
    // Update data-theme attribute for CSS custom properties
    document.documentElement.setAttribute('data-theme', newTheme)
    
    // Update Tailwind dark mode class
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    
    try {
      localStorage.setItem('theme', newTheme)
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}
