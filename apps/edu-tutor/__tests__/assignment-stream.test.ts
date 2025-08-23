import { test, expect } from 'vitest'

test('assignment streaming endpoint emits NDJSON and final full_set', async () => {
  // Call the route directly to avoid relying on a running server
  const { POST } = await import('@/app/api/modes/assignment/generate/route')
  const mockRequest = new Request('http://localhost/api/modes/assignment/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'testing streaming', difficulty: 'Beginner', count: 2 })
  })

  const res = await POST(mockRequest as unknown as import('next/server').NextRequest)

  expect(res.status).toBeLessThan(400)
  const reader = (res as Response).body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined
  expect(reader).toBeDefined()
  const decoder = new TextDecoder()
  let buffer = ''
  let gotVariant = false
  let gotFullSet = false

  while (true) {
  const { done, value } = await reader!.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() || ''
    for (const p of parts) {
      if (!p.trim()) continue
      try {
        const obj = JSON.parse(p)
        if (obj.type === 'variant' || (obj.type === 'assignment')) gotVariant = true
        if (obj.type === 'full_set') {
          gotFullSet = true
          expect(Array.isArray(obj.set)).toBe(true)
          expect(obj.set.length).toBeGreaterThan(0)
        }
      } catch (e) {
        // ignore parse errors for progress text
      }
    }
  }

  expect(gotVariant || gotFullSet).toBe(true)
  expect(gotFullSet).toBe(true)
})
