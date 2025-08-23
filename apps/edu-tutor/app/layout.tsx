import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import ErrorBoundary from '@/components/ErrorBoundary'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Portfolio AI'

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'An AI-powered educational assistant that provides hints-first learning experiences',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning={false}>
      <body className="min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}