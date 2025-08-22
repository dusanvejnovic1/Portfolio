/**
 * Server-Sent Events and NDJSON streaming utilities
 * Provides both client-side and server-side functionality
 */

// === Client-side interfaces and types ===

export interface SSEMessage<T = unknown> {
  type: string
  data: T
}

export interface SSEOptions {
  signal?: AbortSignal
  onMessage?: (message: unknown) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

// === Client-side streaming functions ===

/**
 * Read NDJSON stream from a fetch response
 * Each line should be a complete JSON object
 */
export async function readNDJSONStream<T = unknown>(
  response: Response,
  options: SSEOptions = {}
): Promise<T[]> {
  const { signal, onMessage, onError, onComplete } = options
  
  if (!response.body) {
    throw new Error('No response body available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const results: T[] = []
  let buffer = ''

  try {
    while (true) {
      // Check if aborted
      if (signal?.aborted) {
        throw new Error('Stream aborted')
      }

      const { done, value } = await reader.read()
      
      if (done) break

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
          results.push(parsed)
          
          if (onMessage) {
            onMessage(parsed)
          }
        } catch (parseError) {
          // Avoid logging full line to prevent sensitive data leakage
          const preview = trimmed.length > 20 ? trimmed.slice(0, 20) + '...' : trimmed;
          console.warn('Failed to parse NDJSON line:', { preview, error: parseError })
          if (onError) {
            onError(new Error(`Failed to parse JSON: ${trimmed}`))
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        results.push(parsed)
        if (onMessage) {
          onMessage(parsed)
        }
      } catch (parseError) {
        console.warn('Failed to parse final NDJSON buffer:', { buffer: buffer.length > 100 ? buffer.slice(0, 100) + '...[truncated]' : buffer, error: parseError })
      }
    }

    if (onComplete) {
      onComplete()
    }

    return results

  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

// === Server-side streaming functions ===

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
 * Convenience function to fetch and stream NDJSON from an endpoint
 */
export async function fetchNDJSONStream<T = unknown>(
  url: string,
  options: RequestInit & SSEOptions = {}
): Promise<T[]> {
  const { signal, onMessage, onError, onComplete, ...fetchOptions } = options

  // Set appropriate headers for NDJSON streaming
  const headers = new Headers(fetchOptions.headers)
  headers.set('Accept', 'application/x-ndjson, text/event-stream')

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    signal
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  // Handle both streaming NDJSON and regular JSON responses
  const contentType = response.headers.get('Content-Type') || ''
  
  if (contentType.includes('application/x-ndjson') || contentType.includes('text/event-stream')) {
    // Stream NDJSON (both content types treated as line-delimited JSON)
    return readNDJSONStream<T>(response, { signal, onMessage, onError, onComplete })
  } else {
    // Fallback to regular JSON
    const data = await response.json()
    if (Array.isArray(data)) {
      // If it's an array, process each item
      const results = data as T[]
      if (onMessage) {
        results.forEach(item => onMessage(item))
      }
      if (onComplete) {
        onComplete()
      }
      return results
    } else {
      // Single object - wrap in array
      if (onMessage) {
        onMessage(data)
      }
      if (onComplete) {
        onComplete()
      }
      return [data]
    }
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