/**
 * Utility functions for batching and partitioning curriculum generation
 */

/**
 * Partitions a range of days into smaller batches for parallel processing
 * @param totalDays Total number of days to generate
 * @param batchSize Number of days per batch
 * @returns Array of day number arrays
 */
export function partitionDays(totalDays: number, batchSize: number): number[][] {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const batches: number[][] = []
  
  for (let i = 0; i < days.length; i += batchSize) {
    batches.push(days.slice(i, i + batchSize))
  }
  
  return batches
}

/**
 * Runs tasks with limited concurrency
 * @param tasks Array of task functions to execute
 * @param limit Maximum number of concurrent tasks
 */
export async function runWithConcurrency(
  tasks: Array<() => Promise<void>>, 
  limit: number
): Promise<void> {
  const queue = tasks.slice()
  const running: Promise<void>[] = []
  
  for (let i = 0; i < Math.min(limit, queue.length); i++) {
    running.push(next())
  }
  
  async function next(): Promise<void> {
    const task = queue.shift()
    if (!task) return
    
    try {
      await task()
    } finally {
      if (queue.length > 0) {
        await next()
      }
    }
  }
  
  await Promise.all(running)
}

/**
 * Creates an abort controller registry for managing multiple concurrent operations
 */
export class AbortControllerRegistry {
  private controllers = new Set<AbortController>()
  
  create(): AbortController {
    const controller = new AbortController()
    this.controllers.add(controller)
    return controller
  }
  
  remove(controller: AbortController): void {
    this.controllers.delete(controller)
  }
  
  abortAll(): void {
    for (const controller of this.controllers) {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    }
    this.controllers.clear()
  }
  
  get size(): number {
    return this.controllers.size
  }
}

