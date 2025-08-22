import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Make React available globally for JSX
global.React = React

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // Convert generic props to valid img props for the test renderer
    return React.createElement('img', props as unknown as React.ImgHTMLAttributes<HTMLImageElement>)
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
}))