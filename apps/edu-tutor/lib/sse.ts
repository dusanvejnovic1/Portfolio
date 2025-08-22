/**
 * Robust NDJSON / SSE reader for browser fetch streams.
 *
 * - Accepts both plain NDJSON lines ({"type":...}\n) and SSE-framed events:
 *     data: {...}\n
 *     \n   <= end of event
 * - Handles partial chunks correctly by buffering until a full line/event is available.
 * - Strips SSE "data:" prefixes, ignores SSE comments (lines starting with ":"), and
 *   ignores `[DONE]` markers.
 * - Calls onMessage for every parsed JSON object, onError for parse/network errors,
 *   and onComplete when the stream ends normally.
 *
 * Usage:
 * await fetchNDJSONStream('/api/endpoint', {
 *   method: 'POST',
 *   headers: {...},
 *   body: JSON.stringify(payload),
 *   signal,
 *   onMessage: (msg) => { ... },
 *   onError: (err) => { ... },
 *   onComplete: () => { ... }
 * })
 */

export interface FetchNDJSONOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null
  onMessage?: (message: unknown) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

/**
 * Fetch a streaming NDJSON/SSE endpoint and process incoming JSON messages robustly.
 */
export async function fetchNDJSONStream(url: string, options: FetchNDJSONOptions = {}): Promise<void> {
  const { onMessage, onError, onComplete, signal, ...fetchInit } = options

  let response: Response
  try {
    response = await fetch(url, {
      ...fetchInit,
      signal
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    onError?.(error)
    throw error
  }

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`)
    onError?.(error)
    throw error
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const error = new Error('No readable stream on response')
    onError?.(error)
    throw error
  }

  const decoder = new TextDecoder()
  let buffer = ''
  // SSE event accumulator: collect "data:" lines until a blank line, then join.
  let sseEventLines: string[] = []

  const processPayload = (payload: string) => {
    const trimmed = payload.trim()
    if (!trimmed) return

    // Ignore SSE "[DONE]" token
    if (trimmed === '[DONE]') return

    try {
      const parsed = JSON.parse(trimmed)
      onMessage?.(parsed)
    } catch (parseError) {
      // Provide preview of the payload (not full to avoid leaking secrets)
      const preview = trimmed.length > 300 ? trimmed.slice(0, 300) + '...' : trimmed
      const err = new Error(`Failed to parse JSON: ${preview}`)
      console.warn('NDJSON parse error', { preview, parseError })
      onError?.(err)
    }
  }

  const handleLine = (rawLine: string) => {
    // Remove any stray carriage return
    const line = rawLine.replace(/\r$/, '')

    // SSE comment line - ignore
    if (line.startsWith(':')) return

    // SSE data line
    if (/^\s*data:/.test(line)) {
      // Strip the "data:" prefix and optional space
      const data = line.replace(/^\s*data:\s?/, '')
      sseEventLines.push(data)
      return
    }

    // Blank line indicates end of an SSE event
    if (line.trim() === '') {
      if (sseEventLines.length > 0) {
        // Join multiple data lines with \n per SSE spec and process as a single payload
        const eventPayload = sseEventLines.join('\n')
        sseEventLines = []
        processPayload(eventPayload)
      }
      return
    }

    // If we have accumulated SSE data lines but encounter a non-data non-blank line,
    // treat the accumulated data as a complete event, process it, then continue with this line.
    if (sseEventLines.length > 0) {
      const eventPayload = sseEventLines.join('\n')
      sseEventLines = []
      processPayload(eventPayload)
    }

    // Otherwise treat this raw line as a plain NDJSON line (server may send JSON per-line)
    processPayload(line)
  }

  try {
    while (true) {
      // Abort handling: if the caller's signal is aborted, cancel reading.
      if (signal?.aborted) {
        try { await reader.cancel(); } catch (_) {}
        const err = new Error('Stream aborted')
        onError?.(err)
        throw err
      }

      const { done, value } = await reader.read()
      if (done) break

      // Decode the chunk and append to buffer
      buffer += decoder.decode(value, { stream: true })

      // Split buffer into lines. Keep the last (possibly partial) piece in `buffer`.
      const parts = buffer.split(/\r?\n/)
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        handleLine(part)
      }
    }

    // Stream finished. Process any remaining buffered content.
    if (buffer.trim()) {
      // There might be leftover SSE data lines plus a trailing fragment - handle both.
      // First, if there's accumulated SSE data lines, include the final buffer as part of it.
      if (sseEventLines.length > 0) {
        sseEventLines.push(buffer)
        const eventPayload = sseEventLines.join('\n')
        sseEventLines = []
        processPayload(eventPayload)
      } else {
        // No SSE accumulation: treat buffer as a final NDJSON line
        processPayload(buffer)
      }
      buffer = ''
    } else if (sseEventLines.length > 0) {
      // No extra buffer but accumulated SSE lines remain - flush them
      const eventPayload = sseEventLines.join('\n')
      sseEventLines = []
      processPayload(eventPayload)
    }

    onComplete?.()
  } catch (streamError) {
    const err = streamError instanceof Error ? streamError : new Error(String(streamError))
    onError?.(err)
    throw err
  } finally {
    try { await reader.releaseLock?.(); } catch (_) {}
  }
}
