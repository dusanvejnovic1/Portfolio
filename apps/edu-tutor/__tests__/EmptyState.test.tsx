import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../components/EmptyState'

describe('EmptyState', () => {
  it('renders default welcome message', () => {
    render(<EmptyState />)
    
    expect(screen.getByText('Welcome to your AI tutor!')).toBeInTheDocument()
    expect(screen.getByText(/Ask any educational question/)).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState 
        title="Custom Title"
        description="Custom description for testing"
      />
    )
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom description for testing')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const mockAction = vi.fn()
    
    render(
      <EmptyState 
        actionText="Get Started"
        onAction={mockAction}
      />
    )
    
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('shows example prompts', () => {
    render(<EmptyState />)
    
    expect(screen.getByText('Try asking:')).toBeInTheDocument()
    expect(screen.getByText('"Explain photosynthesis"')).toBeInTheDocument()
    expect(screen.getByText('Upload a math problem')).toBeInTheDocument()
  })

  it('displays feature badges', () => {
    render(<EmptyState />)
    
    expect(screen.getByText('JPEG & PNG Support')).toBeInTheDocument()
    expect(screen.getByText('Up to 500MB')).toBeInTheDocument()
    expect(screen.getByText('AI-Powered Analysis')).toBeInTheDocument()
  })
})