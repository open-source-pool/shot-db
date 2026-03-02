import type { Shot } from '../types'

export type UserShotStatus = 'active' | 'pending'

export interface UserShotStatusRow {
  shot_id: string
  status: UserShotStatus
}

/**
 * Resolve a shot status for the current user.
 * Missing rows default to pending.
 */
export function resolveShotStatus(
  shotId: string,
  statusByShotId: ReadonlyMap<string, UserShotStatus>
): UserShotStatus {
  return statusByShotId.get(shotId) ?? 'pending'
}

export function buildStatusMap(
  rows: UserShotStatusRow[]
): Map<string, UserShotStatus> {
  const map = new Map<string, UserShotStatus>()
  for (const row of rows) {
    map.set(row.shot_id, row.status)
  }
  return map
}

/**
 * Merge shared shots with user-scoped status rows.
 * The returned status is always user-scoped.
 */
export function applyUserStatuses(
  shots: Shot[],
  rows: UserShotStatusRow[]
): Shot[] {
  const statusMap = buildStatusMap(rows)
  return shots.map((shot) => ({
    ...shot,
    status: resolveShotStatus(shot.id, statusMap),
  }))
}

export function selectActiveShots(shots: Shot[]): Shot[] {
  return shots.filter((shot) => shot.status === 'active')
}
