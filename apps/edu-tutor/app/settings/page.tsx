"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import ThemeProvider, { useTheme } from '@/components/ThemeProvider'

function SettingsContent() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    // ensure document theme attribute is synced
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          ← Back to Home
        </Link>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Settings</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Theme</h3>
            <p className="text-sm text-gray-500">Dark mode is the default. Toggle to switch.</p>
          </div>
          <div>
            <label className="inline-flex items-center space-x-3">
              <span className="text-sm">Light</span>
              <input
                type="checkbox"
                className="toggle"
                checked={theme === 'dark'}
                onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
              />
              <span className="text-sm">Dark</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ThemeProvider>
      <SettingsContent />
    </ThemeProvider>
  )
}
