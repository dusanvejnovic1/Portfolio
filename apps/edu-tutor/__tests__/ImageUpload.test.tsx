import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ImageUpload from '../components/ImageUpload'

// Mock FileReader properly
globalThis.FileReader = class {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null
  
  readAsDataURL() {
    // Simulate successful file read
    setTimeout(() => {
      if (this.onload) {
        // Assert `this` as FileReader for TypeScript and construct event
        const ev = { target: { result: 'data:image/jpeg;base64,test' } } as ProgressEvent<FileReader>
        this.onload.call(this as unknown as FileReader, ev)
      }
    }, 0)
  }
} as unknown as typeof globalThis.FileReader

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
    
    // Wait for the component to process the file and show preview
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    }, { timeout: 100 })
    
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
    
    // Find the file input directly
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement
    expect(fileInput).toHaveAttribute('type', 'file')
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg,image/png')
  })
})