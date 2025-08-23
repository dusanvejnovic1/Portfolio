import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

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
  // Inline script to set theme early and avoid flash of incorrect theme
  const setThemeScript = `
    (function(){
      try{
        var t = localStorage.getItem('theme');
        if(!t){ t = 'dark'; localStorage.setItem('theme','dark'); }
        document.documentElement.setAttribute('data-theme', t);
      }catch(e){}
    })();
  `

  const SERVER_THEME = 'dark'

  return (
    <html lang="en" data-theme={SERVER_THEME}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: setThemeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}