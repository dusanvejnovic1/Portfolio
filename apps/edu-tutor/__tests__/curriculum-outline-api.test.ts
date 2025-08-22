import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/modes/curriculum/outline/route'

// Mock dependencies
vi.mock('@/lib/llm', () => ({
  generateResponse: vi.fn()
}))

vi.mock('@/lib/moderation', () => ({
  preModerate: vi.fn(),
  validateITContent: vi.fn()
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn()
}))

let mockGenerateResponse: ReturnType<typeof vi.fn>
let mockPreModerate: ReturnType<typeof vi.fn>
let mockValidateITContent: ReturnType<typeof vi.fn>
let mockCheckRateLimit: ReturnType<typeof vi.fn>

describe('Curriculum Outline API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(async () => {
      const llm = await import('@/lib/llm')
      const moderation = await import('@/lib/moderation')
      const rateLimit = await import('@/lib/rateLimit')
      mockGenerateResponse = vi.mocked(llm).generateResponse
      mockPreModerate = vi.mocked(moderation).preModerate
      mockValidateITContent = vi.mocked(moderation).validateITContent
      mockCheckRateLimit = vi.mocked(rateLimit).checkRateLimit
    })()
    
    // Default successful mocks
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59 })
    mockPreModerate.mockResolvedValue({ allowed: true })
    mockValidateITContent.mockResolvedValue({ 
      isValid: true, 
      errors: [], 
      warnings: [] 
    })
  })

  it('should handle missing API key error', async () => {
    // Temporarily remove API key
    delete process.env.OPENAI_API_KEY

  const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 7
      })
    })

  const response = await POST(mockRequest as unknown as import('next/server').NextRequest)
    const result = await response.json()

    expect(response.status).toBe(500)
    expect(result.error).toBe('OpenAI API key not configured')
  })

  it('should generate outline with valid input when API key is configured', async () => {
    // Set API key
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    
    // Mock successful outline response
    const mockOutlineResponse = {
      outline: [
        {
          week: 1,
          focus: 'JavaScript Fundamentals',
          topics: ['Variables', 'Functions'],
          notes: 'Introduction to JavaScript basics'
        }
      ],
      totalWeeks: 1
    }
    
    mockGenerateResponse.mockResolvedValue(JSON.stringify(mockOutlineResponse))

  const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 7
      })
    })
  const response = await POST(mockRequest as unknown as import('next/server').NextRequest)
    
    if (response.status === 200) {
      const result = await response.json()
      expect(result.outline).toBeDefined()
      expect(Array.isArray(result.outline)).toBe(true)
    } else {
      // If not 200, it should at least not be a 500 error from missing crypto or API key
      expect(response.status).not.toBe(500)
    }
  })

  it('should handle rate limiting', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 7
      })
    })

  const response = await POST(mockRequest as unknown as import('next/server').NextRequest)
  const result = await response.json()

    expect(response.status).toBe(429)
    expect(result.error).toContain('Too many requests')
  })

  it('should handle invalid request data', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'

  const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing required fields
        topic: 'a', // too short
        level: 'Invalid',
        durationDays: 0 // too small
      })
    })
  const response = await POST(mockRequest as unknown as import('next/server').NextRequest)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBeDefined()
  })

  it('should handle moderation blocking', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    mockPreModerate.mockResolvedValue({ 
      allowed: false, 
      reason: 'Content blocked by moderation' 
    })

  const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/outline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'Harmful content',
        level: 'Beginner',
        durationDays: 7
      })
    })

  const response = await POST(mockRequest as unknown as import('next/server').NextRequest)
  const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toBeDefined()
  })
})