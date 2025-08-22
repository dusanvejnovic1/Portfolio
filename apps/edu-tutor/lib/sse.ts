/**
 * Client-side NDJSON Server-Sent Events utility
 * Handles streaming responses from endpoints that return newline-delimited JSON
 */

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
          console.warn('Failed to parse NDJSON line:', { line: trimmed, error: parseError })
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
        console.warn('Failed to parse final NDJSON buffer:', { buffer, error: parseError })
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
  
  if (contentType.includes('application/x-ndjson')) {
    // Stream NDJSON
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