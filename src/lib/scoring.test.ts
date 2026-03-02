import { describe, expect, it } from 'vitest'
import type { Assessment, Shot } from '../types'
import { prioritizeShots } from './scoring'
import { applyUserStatuses } from './user-shot-status'

function makeShot(id: string, status: 'active' | 'pending', frequency: 1 | 2 | 3): Shot {
  return {
    id,
    slug: `shot-${id}`,
    title: `Shot ${id}`,
    description: null,
    setup_text: null,
    status,
    frequency,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeAssessment(shotId: string, score: 1 | 2 | 3): Assessment {
  return {
    id: `a-${shotId}`,
    shot_id: shotId,
    assessed_at: '2026-01-02T00:00:00.000Z',
    comfort_level: 3,
    visualization: 3,
    beautiful_stroke: true,
    alignment_correct: true,
    result: 2,
    aggregate_score: score,
    notes: null,
  }
}

describe('prioritizeShots with user-resolved status', () => {
  it('includes only active shots after applying user statuses', () => {
    const sharedShots = [
      makeShot('s1', 'active', 3),
      makeShot('s2', 'active', 2),
      makeShot('s3', 'pending', 1),
    ]

    const userResolvedShots = applyUserStatuses(sharedShots, [
      { shot_id: 's1', status: 'pending' },
      { shot_id: 's2', status: 'active' },
      // s3 missing row -> pending
    ])

    const prioritized = prioritizeShots(userResolvedShots, [
      makeAssessment('s2', 2),
      makeAssessment('s1', 1),
      makeAssessment('s3', 3),
    ])

    expect(prioritized).toHaveLength(1)
    expect(prioritized[0].shot.id).toBe('s2')
  })
})
