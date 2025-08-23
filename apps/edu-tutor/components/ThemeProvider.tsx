"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'dark',
  setTheme: () => {}
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved)
        document.documentElement.setAttribute('data-theme', saved)
        // Also toggle Tailwind class-based dark mode
        if (saved === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
      } else {
        // default to dark
        setThemeState('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      }
  } catch {
      document.documentElement.setAttribute('data-theme', 'dark')
      setThemeState('dark')
      document.documentElement.classList.add('dark')
    }
  }, [])

  const setTheme = (theme: Theme) => {
    setThemeState(theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    document.documentElement.setAttribute('data-theme', theme)
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
