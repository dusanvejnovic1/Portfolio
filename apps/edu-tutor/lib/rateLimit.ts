// Rate limiter interface for extensibility
export interface RateLimiter {
  checkLimit(identifier: string): { allowed: boolean; remaining: number }
}

// In-memory rate limiter implementation for MVP
// In production, consider using Redis or a database
interface RateLimitEntry {
  requests: number[]
  windowStart: number
}

class InMemoryRateLimiter implements RateLimiter {
  private rateLimitMap = new Map<string, RateLimitEntry>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor() {
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') // 1 minute
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '60') // 60 requests

    // Clean up old entries periodically to prevent memory leaks
    setInterval(() => {
      this.cleanupOldEntries()
    }, this.windowMs)
  }

  private cleanupOldEntries() {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    this.rateLimitMap.forEach((entry, key) => {
      entry.requests = entry.requests.filter(timestamp => timestamp > windowStart)
      if (entry.requests.length === 0) {
        this.rateLimitMap.delete(key)
      }
    })
  }

  checkLimit(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    let entry = this.rateLimitMap.get(identifier)
    
    if (!entry) {
      entry = { requests: [], windowStart }
      this.rateLimitMap.set(identifier, entry)
    }
    
    // Remove old requests outside the window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart)
    
    const currentRequests = entry.requests.length
    
    if (currentRequests >= this.maxRequests) {
      return { allowed: false, remaining: 0 }
    }
    
    // Add current request
    entry.requests.push(now)
    
    return { allowed: true, remaining: this.maxRequests - currentRequests - 1 }
  }
}

// TODO: Redis-based rate limiter for production
// class RedisRateLimiter implements RateLimiter {
//   constructor(private redisClient: Redis) {}
//   
//   async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
//     // Implementation using Redis with sliding window or token bucket
//     // Can be enabled by setting REDIS_URL environment variable
//   }
// }

// Factory function to create appropriate rate limiter
function createRateLimiter(): RateLimiter {
  // TODO: In the future, check for REDIS_URL or similar env vars
  // if (process.env.REDIS_URL) {
  //   return new RedisRateLimiter(redis)
  // }
  
  return new InMemoryRateLimiter()
}

// Export the default rate limiter instance
const rateLimiter = createRateLimiter()

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  return rateLimiter.checkLimit(identifier)
}