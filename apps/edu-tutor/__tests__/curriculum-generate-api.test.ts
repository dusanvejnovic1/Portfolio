/**
 * Tests for the curriculum generation API endpoint
 * Specifically testing the generateSingleDay function implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the OpenAI client before importing the module under test
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}

// Mock the OpenAI module
vi.mock('@/lib/openai', () => ({
  openai: () => mockOpenAI
}))

// Mock the curriculum prompts
vi.mock('@/lib/prompts/curriculum', () => ({
  curriculumSystemPrompt: vi.fn(() => 'Mock system prompt for curriculum generation'),
  curriculumUserPrompt: vi.fn(() => 'Mock user prompt for curriculum generation')
}))

describe('Curriculum Generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have generateSingleDay function available', async () => {
    // Since generateSingleDay is not exported, we test indirectly through the API
    // by verifying the function exists in the compiled module
    const routeModule = await import('@/app/api/modes/curriculum/generate/route')
    
    // Verify the POST function exists (which uses generateSingleDay internally)
    expect(typeof routeModule.POST).toBe('function')
  })

  it('should handle OpenAI response correctly for valid input', async () => {
    const mockResponse = {
      day: 1,
      title: "Day 1: Introduction to JavaScript",
      summary: "Learn the basics of JavaScript programming",
      goals: ["Understand variables", "Learn basic syntax"],
      theorySteps: ["Read about variables", "Study syntax rules"],
      handsOnSteps: ["Write first program", "Practice exercises"],
      resources: [
        {
          title: "JavaScript Guide",
          url: "https://developer.mozilla.org/docs",
          type: "documentation"
        }
      ],
      assignment: "Create a simple calculator",
      checkForUnderstanding: ["What is a variable?", "How do you declare a function?"]
    }

    // Mock successful OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify(mockResponse)
        }
      }]
    })

    // Create a mock request
    const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 1,
        goals: ['Learn JS basics']
      })
    })

    // Import and call the API
    const { POST } = await import('@/app/api/modes/curriculum/generate/route')
    
    // Mock environment variable
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    
    const response = await POST(mockRequest)
    
    // Verify OpenAI was called with correct parameters
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        max_tokens: 1500,
        temperature: 0.3
      })
    )

    // The response should be successful (either JSON or SSE)
    expect(response.status).toBeLessThan(400)
  })

  it('should handle malformed JSON response from OpenAI', async () => {
    // Mock malformed response
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'This is not valid JSON'
        }
      }]
    })

    const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 1
      })
    })

    const { POST } = await import('@/app/api/modes/curriculum/generate/route')
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    
    const response = await POST(mockRequest)
    
    // Should handle the error gracefully
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('should validate required fields in OpenAI response', async () => {
    // Mock response missing required fields
    const incompleteResponse = {
      day: 1
      // Missing title, summary, etc.
    }

    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify(incompleteResponse)
        }
      }]
    })

    const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 1
      })
    })

    const { POST } = await import('@/app/api/modes/curriculum/generate/route')
    process.env.OPENAI_API_KEY = 'sk-test-mock-key'
    
    const response = await POST(mockRequest)
    
    // Should handle validation error
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('should handle missing API key error', async () => {
    delete process.env.OPENAI_API_KEY

    const mockRequest = new Request('http://localhost:3000/api/modes/curriculum/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: 'JavaScript',
        level: 'Beginner',
        durationDays: 1
      })
    })

    const { POST } = await import('@/app/api/modes/curriculum/generate/route')
    
    const response = await POST(mockRequest)
    const result = await response.json()
    
    expect(response.status).toBe(500)
    expect(result.error).toBe('OpenAI API key not configured')
  })
})