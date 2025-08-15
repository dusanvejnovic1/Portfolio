// In-memory rate limiter for MVP
// In production, consider using Redis or a database

interface RateLimitEntry {
  requests: number[]
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60') // 60 requests

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  
  let entry = rateLimitMap.get(identifier)
  
  if (!entry) {
    entry = { requests: [], windowStart }
    rateLimitMap.set(identifier, entry)
  }
  
  // Remove old requests outside the window
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart)
  
  const currentRequests = entry.requests.length
  
  if (currentRequests >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  
  // Add current request
  entry.requests.push(now)
  
  return { allowed: true, remaining: RATE_LIMIT_MAX - currentRequests - 1 }
}

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  
  rateLimitMap.forEach((entry, key) => {
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart)
    if (entry.requests.length === 0) {
      rateLimitMap.delete(key)
    }
  })
}, RATE_LIMIT_WINDOW_MS) // Clean up every window period