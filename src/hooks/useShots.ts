import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Shot } from '../types'
import { applyUserStatuses, type UserShotStatusRow } from '../lib/user-shot-status'

export type ShotStatus = Shot['status']
const SHOT_STATUS_UPDATED_EVENT = 'shot-status-updated'

function notifyShotStatusUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SHOT_STATUS_UPDATED_EVENT))
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    return { userId: null, error: error?.message ?? 'You must be signed in to update shot status.' }
  }
  return { userId: data.user.id, error: null }
}

export async function upsertMyShotStatus(shotId: string, status: ShotStatus) {
  const { userId, error: userError } = await getCurrentUserId()
  if (!userId) return { error: userError ?? 'Unable to resolve current user.' }

  const { error } = await supabase
    .from('user_shot_statuses')
    .upsert(
      [{ user_id: userId, shot_id: shotId, status, updated_at: new Date().toISOString() }],
      { onConflict: 'user_id,shot_id' }
    )

  if (!error) notifyShotStatusUpdated()
  return { error: error?.message ?? null }
}

export function useShots() {
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatusIds, setUpdatingStatusIds] = useState<string[]>([])

  const fetchShots = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [{ data, error: shotsErr }, { data: statusRows, error: statusErr }] = await Promise.all([
      supabase
        .from('shots')
        .select(`
          *,
          images:shot_images(*),
          variations:shot_variations(*, image:shot_images(*)),
          tags:shot_tags(tag:tags(*))
        `)
        .order('title'),
      supabase.from('user_shot_statuses').select('shot_id, status'),
    ])

    if (shotsErr) {
      setError(shotsErr.message)
    } else if (statusErr) {
      setError(statusErr.message)
    } else {
      const mapped = (data ?? []).map((s) => ({
        ...s,
        tags: s.tags?.map((st: { tag: { id: string; name: string } }) => st.tag) ?? [],
      }))
      setShots(applyUserStatuses(mapped, (statusRows ?? []) as UserShotStatusRow[]))
    }
    setLoading(false)
  }, [])

  const setShotStatus = useCallback(async (shotId: string, status: ShotStatus) => {
    setUpdatingStatusIds((prev) => (prev.includes(shotId) ? prev : [...prev, shotId]))
    const { error: statusErr } = await upsertMyShotStatus(shotId, status)
    setUpdatingStatusIds((prev) => prev.filter((id) => id !== shotId))

    if (statusErr) {
      setError(statusErr)
      return statusErr
    }

    setShots((prev) =>
      prev.map((shot) =>
        shot.id === shotId
          ? { ...shot, status }
          : shot
      )
    )
    return null
  }, [])

  const setShotStatusBulk = useCallback(async (shotIds: string[], status: ShotStatus) => {
    const uniqueShotIds = [...new Set(shotIds)]
    if (uniqueShotIds.length === 0) return null

    setUpdatingStatusIds((prev) => [...new Set([...prev, ...uniqueShotIds])])

    const { userId, error: userErr } = await getCurrentUserId()
    if (!userId) {
      setUpdatingStatusIds((prev) => prev.filter((id) => !uniqueShotIds.includes(id)))
      const message = userErr ?? 'Unable to resolve current user.'
      setError(message)
      return message
    }

    const rows = uniqueShotIds.map((shotId) => ({
      user_id: userId,
      shot_id: shotId,
      status,
      updated_at: new Date().toISOString(),
    }))

    const { error: bulkErr } = await supabase
      .from('user_shot_statuses')
      .upsert(rows, { onConflict: 'user_id,shot_id' })

    setUpdatingStatusIds((prev) => prev.filter((id) => !uniqueShotIds.includes(id)))

    if (bulkErr) {
      setError(bulkErr.message)
      return bulkErr.message
    }

    notifyShotStatusUpdated()
    setShots((prev) =>
      prev.map((shot) =>
        uniqueShotIds.includes(shot.id)
          ? { ...shot, status }
          : shot
      )
    )
    return null
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchShots()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchShots])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStatusUpdate = () => {
      void fetchShots()
    }

    window.addEventListener(SHOT_STATUS_UPDATED_EVENT, handleStatusUpdate)
    return () => window.removeEventListener(SHOT_STATUS_UPDATED_EVENT, handleStatusUpdate)
  }, [fetchShots])

  return {
    shots,
    loading,
    error,
    refetch: fetchShots,
    setShotStatus,
    setShotStatusBulk,
    updatingStatusIds,
  }
}

export function useShot(slug: string | undefined) {
  const [shot, setShot] = useState<Shot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchShot = useCallback(async (slugParam?: string) => {
    const s = slugParam ?? slug
    if (!s) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('shots')
      .select(`
        *,
        images:shot_images(*),
        variations:shot_variations(*, image:shot_images(*)),
        tags:shot_tags(tag:tags(*))
      `)
      .eq('slug', s)
      .single()

    if (err) {
      setError(err.message)
    } else if (data) {
      const { data: row, error: rowErr } = await supabase
        .from('user_shot_statuses')
        .select('status')
        .eq('shot_id', data.id)
        .maybeSingle()

      if (rowErr) {
        setError(rowErr.message)
        setLoading(false)
        return
      }

      setShot({
        ...data,
        status: (row?.status as ShotStatus | undefined) ?? 'pending',
        tags: data.tags?.map((st: { tag: { id: string; name: string } }) => st.tag) ?? [],
      })
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!slug) return
    const timeoutId = setTimeout(() => {
      void fetchShot(slug)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [slug, fetchShot])

  return { shot, loading, error, refetch: fetchShot }
}
