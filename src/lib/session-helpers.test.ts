import { describe, expect, it } from 'vitest'
import type { SessionBlock } from '../types'
import { findResumeBlockIndex, sessionTotals } from './session-helpers'

function makeBlock(
  overrides: Partial<SessionBlock> & { block_type: SessionBlock['block_type'] }
): SessionBlock {
  return {
    id: `b-${Math.random().toString(36).slice(2, 8)}`,
    session_id: 'sess-1',
    shot_id: overrides.block_type === 'warmup' || overrides.block_type === 'cooldown' ? null : 'shot-1',
    shot_image_id: null,
    shot_variation_id: null,
    duration_minutes: 20,
    attempts: 0,
    successes: 0,
    comfort_rating: null,
    notes: null,
    sort_order: 0,
    ...overrides,
  }
}

describe('findResumeBlockIndex', () => {
  it('returns 0 for a fresh session with no attempts', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1 }),
      makeBlock({ block_type: 'core', sort_order: 2 }),
      makeBlock({ block_type: 'cooldown', sort_order: 3 }),
    ]
    expect(findResumeBlockIndex(blocks)).toBe(0)
  })

  it('returns the first untouched shot block when partially completed', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1, attempts: 15, successes: 10 }),
      makeBlock({ block_type: 'core', sort_order: 2, attempts: 0, successes: 0 }),
      makeBlock({ block_type: 'reinforcement', sort_order: 3, attempts: 0, successes: 0 }),
      makeBlock({ block_type: 'cooldown', sort_order: 4 }),
    ]
    expect(findResumeBlockIndex(blocks)).toBe(2)
  })

  it('returns the last block index when all shot blocks have attempts', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1, attempts: 10, successes: 5 }),
      makeBlock({ block_type: 'core', sort_order: 2, attempts: 8, successes: 3 }),
      makeBlock({ block_type: 'cooldown', sort_order: 3 }),
    ]
    expect(findResumeBlockIndex(blocks)).toBe(blocks.length - 1)
  })

  it('skips warmup and cooldown blocks when finding untouched', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0, attempts: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1, attempts: 5, successes: 2 }),
      makeBlock({ block_type: 'cooldown', sort_order: 2, attempts: 0 }),
    ]
    // All shot blocks have attempts, warmup/cooldown are ignored
    expect(findResumeBlockIndex(blocks)).toBe(blocks.length - 1)
  })

  it('handles a single shot block with no attempts', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1 }),
      makeBlock({ block_type: 'cooldown', sort_order: 2 }),
    ]
    expect(findResumeBlockIndex(blocks)).toBe(0)
  })

  it('handles empty blocks array', () => {
    expect(findResumeBlockIndex([])).toBe(0)
  })
})

describe('sessionTotals', () => {
  it('sums attempts and successes across shot blocks only', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'core', sort_order: 1, attempts: 20, successes: 15 }),
      makeBlock({ block_type: 'core', sort_order: 2, attempts: 10, successes: 3 }),
      makeBlock({ block_type: 'reinforcement', sort_order: 3, attempts: 5, successes: 4 }),
      makeBlock({ block_type: 'cooldown', sort_order: 4 }),
    ]
    const result = sessionTotals(blocks)
    expect(result.totalAttempts).toBe(35)
    expect(result.totalSuccesses).toBe(22)
  })

  it('returns zeroes for no shot blocks', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0 }),
      makeBlock({ block_type: 'cooldown', sort_order: 1 }),
    ]
    const result = sessionTotals(blocks)
    expect(result.totalAttempts).toBe(0)
    expect(result.totalSuccesses).toBe(0)
  })

  it('returns zeroes for empty array', () => {
    const result = sessionTotals([])
    expect(result.totalAttempts).toBe(0)
    expect(result.totalSuccesses).toBe(0)
  })

  it('excludes warmup and cooldown from totals even if they have attempts', () => {
    const blocks = [
      makeBlock({ block_type: 'warmup', sort_order: 0, attempts: 99, successes: 99 }),
      makeBlock({ block_type: 'core', sort_order: 1, attempts: 5, successes: 3 }),
      makeBlock({ block_type: 'cooldown', sort_order: 2, attempts: 99, successes: 99 }),
    ]
    const result = sessionTotals(blocks)
    expect(result.totalAttempts).toBe(5)
    expect(result.totalSuccesses).toBe(3)
  })
})
