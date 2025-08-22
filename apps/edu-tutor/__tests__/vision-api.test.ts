/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest'
import { POST } from '../app/api/vision/route'

// Mock dependencies
vi.mock('@/lib/openai', () => ({
  openai: () => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }),
  moderateContent: vi.fn().mockResolvedValue({ flagged: false }),
  VISION_MODEL: 'gpt-4o',
  resolveModel: vi.fn((model) => model || 'gpt-4o')
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true)
}))

vi.mock('@/lib/prompts', () => ({
  VISION_SYSTEM_PROMPT: 'Test vision system prompt',
  MODERATION_REFUSAL_MESSAGE: 'Content not allowed',
  RATE_LIMIT_MESSAGE: 'Rate limit exceeded'
}))

describe('Vision API', () => {
  it('returns error when no image is provided', async () => {
    const formData = new FormData()
    formData.append('prompt', 'test prompt')
    
    const request = new Request('http://localhost/api/vision', {
      method: 'POST',
      body: formData
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Image file is required')
  })

  it('returns error for unsupported file types', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    formData.append('image', file)
    
    const request = new Request('http://localhost/api/vision', {
      method: 'POST',
      body: formData
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Only JPEG and PNG images are supported')
  })

  it('returns error for files that are too large', async () => {
    const formData = new FormData()
    // Create a mock file that's larger than 500MB
    const largeFile = new File(['x'.repeat(501 * 1024 * 1024)], 'large.jpg', { 
      type: 'image/jpeg' 
    })
    formData.append('image', largeFile)
    
    const request = new Request('http://localhost/api/vision', {
      method: 'POST',
      body: formData
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toContain('Image file too large')
  })

  it('validates mode parameter', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    formData.append('image', file)
    formData.append('mode', 'invalid-mode')
    
    const request = new Request('http://localhost/api/vision', {
      method: 'POST',
      body: formData
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Mode must be either "hints" or "solution"')
  })

  it('validates prompt length', async () => {
    const formData = new FormData()
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    formData.append('image', file)
    formData.append('prompt', 'x'.repeat(1501))
    
    const request = new Request('http://localhost/api/vision', {
      method: 'POST',
      body: formData
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Prompt too long. Please limit to 1500 characters.')
  })
})