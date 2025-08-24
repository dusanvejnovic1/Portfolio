import { NextResponse } from 'next/server'
import { CurriculumGenerateDayRequestSchema, createErrorResponse, validateCurriculumDay } from '@/lib/schemas/curriculum'
import { curriculumSystemPrompt, curriculumUserPromptForSingleDay } from '@/lib/prompts/curriculum'
import { client as openaiClient, resolveModel, isGpt5 } from '@/lib/openai'
import { createChatCompletion } from '@/lib/llm'
import { normalizeDayData } from '@/lib/streaming/processor'
import type { CurriculumDay } from '@/types/modes'
import crypto from 'crypto'

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  
  try {
    console.log('Single day generation request received:', { requestId, timestamp: new Date().toISOString() })
    
    // Parse and validate request
    const body = await req.json().catch(() => {
      throw new Error('Invalid JSON payload')
    })

    console.log('Request body parsed:', { requestId, bodyKeys: Object.keys(body) })

    const parsed = CurriculumGenerateDayRequestSchema.safeParse(body)
    if (!parsed.success) {
      console.log('Request validation failed:', { requestId, error: parsed.error.format() })
      const error = createErrorResponse(
        'Invalid request parameters',
        parsed.error.format(),
        'VALIDATION_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const requestData = parsed.data

    // Validate day is within range
    if (requestData.day > requestData.totalDays) {
      const error = createErrorResponse(
        'Day number exceeds total days',
        `Day ${requestData.day} is greater than totalDays ${requestData.totalDays}`,
        'VALIDATION_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Ensure OpenAI key exists
    if (!process.env.OPENAI_API_KEY) {
      const error = createErrorResponse(
        'OpenAI API key not configured',
        undefined,
        'CONFIG_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build prompts
    const system = curriculumSystemPrompt()
    const user = curriculumUserPromptForSingleDay(
      requestData.topic,
      requestData.level,
      requestData.day,
      requestData.totalDays,
      requestData.goals
    )

    // Generate content using appropriate model
    const model = resolveModel()
    console.log('Using model:', { requestId, model })
    let responseText: string

    if (isGpt5(model)) {
      console.log('Using GPT-5 Responses API', { requestId })
      // Use Responses API for GPT-5
      const combinedInput = `${system}\n\n${user}`
      const response = await openaiClient.responses.create({
        model,
        input: combinedInput
      })
      
      responseText = response.output?.[0]?.content ?? ''
      console.log('GPT-5 response received:', { requestId, responseLength: responseText.length })
    } else {
      console.log('Using Chat Completions API', { requestId })
      // Use Chat Completions for other models
      const messages = [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: user }
      ]

      const completion = await createChatCompletion(messages, {
        model: 'default',
        maxTokens: 2000,
        temperature: 0.3
      })
      
      console.log('Chat completion received:', { requestId, completionType: typeof completion })

      if (completion && typeof completion === 'object' && 'choices' in completion) {
        const choices = completion.choices as Array<{ message: { content: string } }>
        responseText = choices?.[0]?.message?.content ?? ''
      } else {
        responseText = String(completion)
      }
    }

    console.log('Model response text:', { requestId, responseLength: responseText.length, preview: responseText.substring(0, 200) })

    if (!responseText.trim()) {
      console.log('Empty response from model', { requestId })
      const error = createErrorResponse(
        'Empty response from model',
        'Model returned no content',
        'MODEL_OUTPUT_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse the response to extract day data
    const extractedDay = extractDayFromResponse(responseText, requestData.day)
    console.log('Day extraction result:', { requestId, extracted: !!extractedDay, dayNumber: extractedDay?.day })
    
    if (!extractedDay) {
      const error = createErrorResponse(
        'No valid day data found',
        'Model response did not contain valid day structure',
        'MODEL_OUTPUT_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate the extracted day
    if (!validateCurriculumDay(extractedDay)) {
      const error = createErrorResponse(
        'Invalid day data structure',
        'Generated day failed validation',
        'MODEL_OUTPUT_ERROR',
        requestId
      )
      return new NextResponse(JSON.stringify(error), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return successful response
    return new NextResponse(JSON.stringify({
      type: 'day',
      day: extractedDay
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const error = createErrorResponse(
      'Internal server error',
      message,
      'INTERNAL_ERROR',
      requestId
    )
    return new NextResponse(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Extracts curriculum day data from model response text
 * Handles both NDJSON and plain JSON formats
 */
function extractDayFromResponse(responseText: string, expectedDay: number): CurriculumDay | null {
  // Split into lines and try to find JSON
  const lines = responseText.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('{')) continue
    
    try {
      const parsed = JSON.parse(trimmed)
      
      // Handle NDJSON format: {"type":"day","day":{...}}
      if (parsed.type === 'day' && parsed.day) {
        const normalized = normalizeDayData(parsed.day)
        if (normalized && normalized.day === expectedDay) {
          return normalized
        }
      }
      
      // Handle plain JSON format: {"day":1,"title":"...",...}
      if (parsed.day === expectedDay || (typeof parsed.day === 'number' && parsed.day === expectedDay)) {
        const normalized = normalizeDayData(parsed)
        if (normalized && normalized.day === expectedDay) {
          return normalized
        }
      }
    } catch {
      // Not valid JSON, continue
    }
  }
  
  // Try parsing the entire response as JSON
  try {
    const parsed = JSON.parse(responseText)
    
    // Handle NDJSON format
    if (parsed.type === 'day' && parsed.day) {
      const normalized = normalizeDayData(parsed.day)
      if (normalized && normalized.day === expectedDay) {
        return normalized
      }
    }
    
    // Handle plain JSON format
    if (parsed.day === expectedDay || (typeof parsed.day === 'number' && parsed.day === expectedDay)) {
      const normalized = normalizeDayData(parsed)
      if (normalized && normalized.day === expectedDay) {
        return normalized
      }
    }
  } catch {
    // Not valid JSON
  }
  
  return null
}
