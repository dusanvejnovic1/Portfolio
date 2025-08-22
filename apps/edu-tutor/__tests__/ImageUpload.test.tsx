import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ImageUpload from '../components/ImageUpload'

// Mock FileReader properly
global.FileReader = class {
  onload: ((event: any) => void) | null = null
  
  readAsDataURL(file: File) {
    // Simulate async behavior
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: {
            result: `data:${file.type};base64,mocked-base64-data`
          }
        })
      }
    }, 0)
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

  it('shows file name when image is selected', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const mockOnImageChange = vi.fn()
    
    render(
      <ImageUpload 
        currentImage={mockFile} 
        onImageChange={mockOnImageChange} 
      />
    )
    
    // Wait for the FileReader to complete and component to re-render
    await screen.findByText('test.jpg')
    
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
    
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg,image/png')
  })
})