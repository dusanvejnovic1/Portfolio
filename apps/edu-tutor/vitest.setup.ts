import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Make React available globally for JSX
global.React = React

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return React.createElement('img', props)
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