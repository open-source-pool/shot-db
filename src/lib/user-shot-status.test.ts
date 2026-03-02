import { describe, expect, it } from 'vitest'
import type { Shot } from '../types'
import { applyUserStatuses, resolveShotStatus, selectActiveShots } from './user-shot-status'

function makeShot(id: string, status: 'active' | 'pending'): Shot {
  return {
    id,
    slug: `shot-${id}`,
    title: `Shot ${id}`,
    description: null,
    setup_text: null,
    status,
    frequency: 2,
    created_at: new Date().toISOString(),
  }
}

describe('user shot status helpers', () => {
  it('defaults missing user status rows to pending', () => {
    const status = resolveShotStatus('missing', new Map())
    expect(status).toBe('pending')
  })

  it('applies user overrides and keeps missing rows pending', () => {
    const shared = [
      makeShot('s1', 'active'),
      makeShot('s2', 'active'),
      makeShot('s3', 'pending'),
    ]

    const merged = applyUserStatuses(shared, [
      { shot_id: 's1', status: 'pending' },
      { shot_id: 's3', status: 'active' },
    ])

    expect(merged.find((shot) => shot.id === 's1')?.status).toBe('pending')
    expect(merged.find((shot) => shot.id === 's2')?.status).toBe('pending')
    expect(merged.find((shot) => shot.id === 's3')?.status).toBe('active')
  })

  it('selects only active shots for practice flows', () => {
    const shots = [
      makeShot('s1', 'pending'),
      makeShot('s2', 'active'),
      makeShot('s3', 'pending'),
      makeShot('s4', 'active'),
    ]

    expect(selectActiveShots(shots).map((shot) => shot.id)).toEqual(['s2', 's4'])
  })
})
