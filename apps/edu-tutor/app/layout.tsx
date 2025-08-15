import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Educational Tutor',
  description: 'An AI-powered educational assistant that provides hints-first learning experiences',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}