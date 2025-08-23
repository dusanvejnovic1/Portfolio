import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion, generateResponse } from '@/lib/llm'
import { AssignmentVariant } from '@/types/modes'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const variant = body.variant as Record<string, unknown> | undefined
    if (!variant || !variant.id) {
      return NextResponse.json({ error: 'Invalid variant payload' }, { status: 400 })
    }

  // Build a focused prompt asking for full variant details for the single id
    const prompt = `Expand this compact assignment summary into a full AssignmentVariant JSON object with keys: id, title, scenario, objectives (array), steps (array), deliverables (array), rubric (array of criteria with levels and weights), hints (array), stretchGoals (array). Preserve the same id: ${String(variant.id)}. Use concise text but include details.`

    // Prefer Chat Completions for simplicity and bounded tokens
    try {
  const completion = await createChatCompletion([
        { role: 'system', content: 'You are an assistant that returns strict JSON only.' },
        { role: 'user', content: prompt + '\n\nSummary:\n' + JSON.stringify(variant) }
      ], { model: 'quality', maxTokens: 800, temperature: 0.2 })
  const maybeChoices = (completion as unknown as { choices?: Array<{ message?: { content?: unknown } }> }).choices
  const text = maybeChoices && maybeChoices[0] && maybeChoices[0].message && maybeChoices[0].message.content
  if (!text || typeof text !== 'string') throw new Error('Empty model response')

      // Try to parse JSON from the model output
      const maybe = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(maybe) as AssignmentVariant

      return NextResponse.json(parsed)
  } catch {
      // Fallback: use generateResponse which returns raw text
      try {
        const fallback = await generateResponse(prompt + '\n\nSummary:\n' + JSON.stringify(variant), 'You are an assistant that returns JSON only.', { model: 'quality', maxTokens: 800, temperature: 0.2 })
        const maybe = fallback.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
        const parsed = JSON.parse(maybe) as AssignmentVariant
        return NextResponse.json(parsed)
      } catch (e) {
        console.error('Variant expand fallback failed:', e)
        return NextResponse.json({ error: 'Failed to expand variant' }, { status: 500 })
      }
    }
  } catch (error) {
    console.error('Expand route error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
