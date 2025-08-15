import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageSkeleton, ConversationListSkeleton, LoadingDots, TypingIndicator } from '../components/SkeletonLoader'

describe('SkeletonLoader Components', () => {
  describe('MessageSkeleton', () => {
    it('renders single message skeleton by default', () => {
      render(<MessageSkeleton />)
      
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('renders multiple message skeletons when count is specified', () => {
      render(<MessageSkeleton count={3} />)
      
      const messageContainers = document.querySelectorAll('.flex.justify-start.mb-4')
      expect(messageContainers).toHaveLength(3)
    })
  })

  describe('ConversationListSkeleton', () => {
    it('renders conversation list skeletons', () => {
      render(<ConversationListSkeleton />)
      
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('LoadingDots', () => {
    it('renders three animated dots', () => {
      render(<LoadingDots />)
      
      const dots = document.querySelectorAll('.animate-bounce')
      expect(dots).toHaveLength(3)
    })
  })

  describe('TypingIndicator', () => {
    it('renders typing indicator with message', () => {
      render(<TypingIndicator />)
      
      expect(screen.getByText('AI is typing...')).toBeInTheDocument()
      
      const dots = document.querySelectorAll('.animate-bounce')
      expect(dots.length).toBeGreaterThan(0)
    })
  })
})