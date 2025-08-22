import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}