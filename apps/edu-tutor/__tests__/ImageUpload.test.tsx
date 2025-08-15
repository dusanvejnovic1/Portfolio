import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ImageUpload from '../components/ImageUpload'

// Mock FileReader
global.FileReader = class {
  readAsDataURL() {
    // Don't call onload since we're mocking
  }
} as any

describe('ImageUpload', () => {
  it('renders upload area when no image is selected', () => {
    const mockOnImageChange = vi.fn()
    
    render(
      <ImageUpload 
        currentImage={null} 
        onImageChange={mockOnImageChange} 
      />
    )
    
    expect(screen.getByText('Click to upload')).toBeInTheDocument()
    expect(screen.getByText('or drag and drop')).toBeInTheDocument()
    expect(screen.getByText('JPEG, PNG up to 500MB')).toBeInTheDocument()
  })

  it('shows file name when image is selected', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const mockOnImageChange = vi.fn()
    
    render(
      <ImageUpload 
        currentImage={mockFile} 
        onImageChange={mockOnImageChange} 
      />
    )
    
    // Should show file info instead of upload area
    expect(screen.getByText('test.jpg')).toBeInTheDocument()
    expect(screen.queryByText('Click to upload')).not.toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    const mockOnImageChange = vi.fn()
    
    render(
      <ImageUpload 
        currentImage={null} 
        onImageChange={mockOnImageChange} 
        disabled={true}
      />
    )
    
    const uploadArea = document.querySelector('[class*="border-2"]')
    expect(uploadArea).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('accepts correct file types', () => {
    const mockOnImageChange = vi.fn()
    
    render(
      <ImageUpload 
        currentImage={null} 
        onImageChange={mockOnImageChange} 
      />
    )
    
    const fileInput = screen.getByRole('button', { name: /click to upload/i }).parentElement?.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg,image/png')
  })
})