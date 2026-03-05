import type { SessionBlock } from '../types'

/**
 * Find the block index to resume a session at.
 * - Fresh session (no attempts on any shot block): returns 0
 * - Partially completed: returns the first shot block with 0 attempts
 * - Fully completed: returns the last block index
 */
export function findResumeBlockIndex(blocks: SessionBlock[]): number {
  const shotBlocks = blocks.filter(
    (b) => b.block_type !== 'warmup' && b.block_type !== 'cooldown'
  )
  const hasAnyAttempts = shotBlocks.some((b) => (b.attempts ?? 0) > 0)
  if (!hasAnyAttempts) return 0

  const firstUntouched = blocks.findIndex(
    (b) =>
      b.block_type !== 'warmup' &&
      b.block_type !== 'cooldown' &&
      (b.attempts ?? 0) === 0
  )

  return firstUntouched !== -1 ? firstUntouched : blocks.length - 1
}

/**
 * Compute session-wide totals across all shot blocks (excluding warmup/cooldown).
 */
export function sessionTotals(blocks: SessionBlock[]): {
  totalAttempts: number
  totalSuccesses: number
} {
  let totalAttempts = 0
  let totalSuccesses = 0
  for (const b of blocks) {
    if (b.block_type === 'warmup' || b.block_type === 'cooldown') continue
    totalAttempts += b.attempts ?? 0
    totalSuccesses += b.successes ?? 0
  }
  return { totalAttempts, totalSuccesses }
}
