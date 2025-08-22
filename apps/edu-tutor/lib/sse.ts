/**
 * Server-Sent Events utility for parsing NDJSON streams
 */

/**
 * Async generator that reads and parses NDJSON lines from a stream
 * @param stream - ReadableStream<Uint8Array> containing NDJSON data
 * @yields Parsed JSON objects from each line
 */
export async function* ndjsonSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim())
            yield parsed
          } catch {
            console.warn('Failed to parse final buffer content:', buffer)
          }
        }
        break
      }

      // Decode chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed)
          yield parsed
        } catch {
          console.warn('Failed to parse NDJSON line:', trimmed)
          // Continue processing other lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Helper function to create an SSE ReadableStream from NDJSON data
 * @param data - Array of objects to stream as NDJSON
 * @returns ReadableStream formatted for SSE with proper content-type
 */
export function createNDJSONStream(data: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      // Stream each object as NDJSON
      for (const item of data) {
        const line = JSON.stringify(item) + '\n'
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    }
  })
}

/**
 * Utility to check if request accepts SSE (text/event-stream)
 */
export function acceptsSSE(request: Request): boolean {
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/event-stream')
}

/**
 * Create headers for SSE response
 */
export function createSSEHeaders(origin?: string, allowedOrigin?: string): Headers {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Credentials': 'true'
  })

  // CORS handling
  if (allowedOrigin === '*' || origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', origin || '*')
    headers.set('Access-Control-Allow-Methods', 'POST')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept')
  }

  return headers
}