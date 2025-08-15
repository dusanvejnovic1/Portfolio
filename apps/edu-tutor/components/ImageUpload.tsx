'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'

interface ImageUploadProps {
  onImageChange: (file: File | null) => void
  disabled?: boolean
  currentImage: File | null
}

export default function ImageUpload({ onImageChange, disabled = false, currentImage }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update preview when currentImage changes
  React.useEffect(() => {
    if (currentImage) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(currentImage)
    } else {
      setPreview(null)
    }
  }, [currentImage])

  const validateFile = (file: File): string | null => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG and PNG images are supported'
    }

    // Check file size (500MB = 524,288,000 bytes)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      return `Image file too large. Maximum size is 500MB, got ${Math.round(file.size / (1024 * 1024))}MB`
    }

    return null
  }

  const handleFile = (file: File) => {
    const error = validateFile(file)
    if (error) {
      alert(error)
      return
    }

    onImageChange(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files?.[0]) {
      handleFile(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setDragActive(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.[0]) {
      handleFile(files[0])
    }
  }

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleRemove = () => {
    onImageChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  if (currentImage && preview) {
    return (
      <div className="relative">
        <div className="relative bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-3">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <Image
                src={preview}
                alt="Upload preview"
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-md"
                unoptimized
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {currentImage.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(currentImage.size / (1024 * 1024)).toFixed(1)} MB • {currentImage.type}
              </p>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors
          ${dragActive && !disabled
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            JPEG, PNG up to 500MB
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  )
}