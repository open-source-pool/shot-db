import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Shot } from '../../src/types'
import { applyUserStatuses, selectActiveShots, type UserShotStatus } from '../../src/lib/user-shot-status'

interface UserShotStatusRow {
  user_id: string
  shot_id: string
  status: UserShotStatus
}

class MockShotDb {
  private shots = new Map<string, Shot>()
  private userStatuses = new Map<string, Map<string, UserShotStatus>>()

  createUser(): string {
    return `user-${randomUUID().slice(0, 8)}`
  }

  insertShot(_actorUserId: string, input: Pick<Shot, 'slug' | 'title' | 'frequency' | 'status'>): Shot {
    const id = randomUUID()
    const shot: Shot = {
      id,
      slug: input.slug,
      title: input.title,
      description: null,
      setup_text: null,
      status: input.status,
      frequency: input.frequency,
      created_at: new Date().toISOString(),
    }
    this.shots.set(id, shot)
    return shot
  }

  updateShot(_actorUserId: string, shotId: string, patch: Partial<Pick<Shot, 'title'>>): Shot {
    const existing = this.shots.get(shotId)
    if (!existing) throw new Error(`Shot ${shotId} not found`)
    const updated = { ...existing, ...patch }
    this.shots.set(shotId, updated)
    return updated
  }

  getShot(_actorUserId: string, shotId: string): Shot | null {
    return this.shots.get(shotId) ?? null
  }

  upsertUserShotStatus(actorUserId: string, row: UserShotStatusRow): void {
    if (row.user_id !== actorUserId) {
      throw new Error('RLS violation: cannot write another user status row')
    }
    const map = this.userStatuses.get(actorUserId) ?? new Map<string, UserShotStatus>()
    map.set(row.shot_id, row.status)
    this.userStatuses.set(actorUserId, map)
  }

  /**
   * Mimics RLS: users only ever see their own rows even if they filter by another user_id.
   */
  listUserShotStatuses(
    actorUserId: string,
    filter: { shot_id?: string; user_id?: string } = {}
  ): UserShotStatusRow[] {
    const own = this.userStatuses.get(actorUserId) ?? new Map<string, UserShotStatus>()
    const rows: UserShotStatusRow[] = [...own.entries()].map(([shot_id, status]) => ({
      user_id: actorUserId,
      shot_id,
      status,
    }))

    return rows.filter((row) => {
      if (filter.shot_id && row.shot_id !== filter.shot_id) return false
      if (filter.user_id && row.user_id !== filter.user_id) return false
      return true
    })
  }

  listShotsForPractice(actorUserId: string): Shot[] {
    const sharedShots = [...this.shots.values()]
    const statusRows = this.listUserShotStatuses(actorUserId).map((row) => ({
      shot_id: row.shot_id,
      status: row.status,
    }))
    return selectActiveShots(applyUserStatuses(sharedShots, statusRows))
  }
}

describe('mocked multi-user shot behavior', () => {
  it('keeps shots shared across users for visibility', () => {
    const db = new MockShotDb()
    const userA = db.createUser()
    const userB = db.createUser()

    const shot = db.insertShot(userA, {
      slug: 'mock-shared-visibility',
      title: 'Mock Shared Visibility',
      frequency: 2,
      status: 'pending',
    })

    const bView = db.getShot(userB, shot.id)
    expect(bView?.id).toBe(shot.id)
  })

  it('allows one user to edit a shot created by another user', () => {
    const db = new MockShotDb()
    const userA = db.createUser()
    const userB = db.createUser()

    const shot = db.insertShot(userA, {
      slug: 'mock-shared-edit',
      title: 'Original Title',
      frequency: 2,
      status: 'pending',
    })

    db.updateShot(userB, shot.id, { title: 'Edited By User B' })
    const aView = db.getShot(userA, shot.id)
    expect(aView?.title).toBe('Edited By User B')
  })

  it('isolates per-user active subsets and defaults missing rows to pending', () => {
    const db = new MockShotDb()
    const userA = db.createUser()
    const userB = db.createUser()

    const shot1 = db.insertShot(userA, {
      slug: 'mock-status-1',
      title: 'Status 1',
      frequency: 2,
      status: 'active',
    })
    const shot2 = db.insertShot(userA, {
      slug: 'mock-status-2',
      title: 'Status 2',
      frequency: 2,
      status: 'active',
    })

    db.upsertUserShotStatus(userA, {
      user_id: userA,
      shot_id: shot1.id,
      status: 'active',
    })
    db.upsertUserShotStatus(userA, {
      user_id: userA,
      shot_id: shot2.id,
      status: 'pending',
    })

    db.upsertUserShotStatus(userB, {
      user_id: userB,
      shot_id: shot2.id,
      status: 'active',
    })
    // userB has no row for shot1 -> pending by default

    expect(db.listShotsForPractice(userA).map((shot) => shot.id)).toEqual([shot1.id])
    expect(db.listShotsForPractice(userB).map((shot) => shot.id)).toEqual([shot2.id])
  })

  it('prevents cross-user status leakage and writes', () => {
    const db = new MockShotDb()
    const userA = db.createUser()
    const userB = db.createUser()

    const shot = db.insertShot(userA, {
      slug: 'mock-cross-user',
      title: 'Cross User Shot',
      frequency: 2,
      status: 'pending',
    })

    db.upsertUserShotStatus(userB, {
      user_id: userB,
      shot_id: shot.id,
      status: 'active',
    })

    const userAViewFilteredToB = db.listUserShotStatuses(userA, {
      user_id: userB,
      shot_id: shot.id,
    })
    expect(userAViewFilteredToB).toHaveLength(0)

    expect(() =>
      db.upsertUserShotStatus(userA, {
        user_id: userB,
        shot_id: shot.id,
        status: 'pending',
      })
    ).toThrow('RLS violation')
  })
})
