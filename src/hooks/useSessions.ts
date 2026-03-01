import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, ShotImage, ShotVariation } from '../types'

export interface ShotSessionEntry {
  session_id: string
  session_date: string
  block_type: string
  duration_minutes: number
  attempts: number
  successes: number
  comfort_rating: number | null
  notes: string | null
  shot_image?: ShotImage | null
  shot_variation?: ShotVariation | null
}

interface SessionDateRef {
  started_at?: string | null
}

interface ShotSessionHistoryRow {
  session_id: string
  block_type: string
  duration_minutes: number
  attempts: number | null
  successes: number | null
  comfort_rating: number | null
  notes: string | null
  shot_image?: ShotImage | null
  shot_variation?: ShotVariation | null
  session?: SessionDateRef | null
}

interface SessionRateRow {
  shot_id: string | null
  attempts: number | null
  successes: number | null
  session?: SessionDateRef | null
}

interface LastPracticedRow {
  shot_id: string | null
  session?: SessionDateRef | null
}

/** Fetch all session blocks for a given shot, newest first */
export function useShotSessionHistory(shotId: string | undefined) {
  const [entries, setEntries] = useState<ShotSessionEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async (id: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('session_blocks')
      .select(`
        id,
        session_id,
        block_type,
        duration_minutes,
        attempts,
        successes,
        comfort_rating,
        notes,
        shot_image:shot_images(*),
        shot_variation:shot_variations(*, image:shot_images(*)),
        session:sessions(started_at)
      `)
      .eq('shot_id', id)
      .order('sort_order', { ascending: true })

    // Flatten and sort by session date desc
    const entries: ShotSessionEntry[] = ((data as ShotSessionHistoryRow[] | null) ?? []).map((row) => ({
      session_id: row.session_id,
      session_date: row.session?.started_at ?? '',
      block_type: row.block_type,
      duration_minutes: row.duration_minutes,
      attempts: row.attempts ?? 0,
      successes: row.successes ?? 0,
      comfort_rating: row.comfort_rating,
      notes: row.notes,
      shot_image: row.shot_image,
      shot_variation: row.shot_variation,
    }))

    // Group by session and aggregate
    entries.sort((a, b) => b.session_date.localeCompare(a.session_date))
    setEntries(entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!shotId) return
    const timeoutId = setTimeout(() => {
      void fetchHistory(shotId)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [shotId, fetchHistory])

  return { entries, loading }
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select(`
        *,
        blocks:session_blocks(
          *,
          shot:shots(id, title, slug)
        )
      `)
      .order('started_at', { ascending: false })

    setSessions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchSessions()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchSessions])

  return { sessions, loading, refetch: fetchSessions }
}

/**
 * Per-session success rate for each shot across all sessions.
 * Returns Map<shot_id, { rate: number; sessionDate: string }[]> sorted chronologically.
 */
export function useShotSuccessRates() {
  const [ratesByShot, setRatesByShot] = useState<Map<string, { rate: number; sessionDate: string }[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('session_blocks')
      .select('shot_id, attempts, successes, session:sessions(started_at)')
      .not('shot_id', 'is', null)
      .gt('attempts', 0)

    const byShot = new Map<string, Map<string, { attempts: number; successes: number; date: string }>>()
    for (const row of (data as SessionRateRow[] | null) ?? []) {
      const shotId = row.shot_id
      const sessionDate = row.session?.started_at ?? undefined
      if (!shotId) continue
      if (!sessionDate) continue

      if (!byShot.has(shotId)) byShot.set(shotId, new Map())
      const sessionMap = byShot.get(shotId)!
      const existing = sessionMap.get(sessionDate)
      if (existing) {
        existing.attempts += row.attempts ?? 0
        existing.successes += row.successes ?? 0
      } else {
        sessionMap.set(sessionDate, {
          attempts: row.attempts ?? 0,
          successes: row.successes ?? 0,
          date: sessionDate,
        })
      }
    }

    const result = new Map<string, { rate: number; sessionDate: string }[]>()
    for (const [shotId, sessionMap] of byShot) {
      const points = [...sessionMap.values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({
          rate: s.attempts > 0 ? s.successes / s.attempts : 0,
          sessionDate: s.date,
        }))
      if (points.length > 0) result.set(shotId, points)
    }

    setRatesByShot(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchRates()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchRates])

  return { ratesByShot, loading }
}

/** Get the count of past sessions for auto-deriving session number */
export async function getSessionCount(): Promise<number> {
  const { count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })

  return count ?? 0
}

/**
 * Fetch the last-practiced date for each shot (most recent session_block date).
 * Returns a Map<shot_id, ISO date string>.
 */
export function useLastPracticed() {
  const [lastPracticedMap, setLastPracticedMap] = useState<Map<string, string>>(new Map())
  const [lastPracticedSessionAgo, setLastPracticedSessionAgo] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchLastPracticed = useCallback(async () => {
    setLoading(true)
    // Get all session blocks with their session dates and session IDs, grouped by shot_id
    const { data } = await supabase
      .from('session_blocks')
      .select('shot_id, session_id, session:sessions(started_at)')
      .not('shot_id', 'is', null)

    // Build ordered list of unique session dates (newest first)
    const sessionDates = new Set<string>()
    for (const row of (data as LastPracticedRow[] | null) ?? []) {
      const date = row.session?.started_at ?? undefined
      if (date) sessionDates.add(date)
    }
    const sortedDates = [...sessionDates].sort((a, b) => b.localeCompare(a))
    const dateToIndex = new Map<string, number>()
    sortedDates.forEach((d, i) => dateToIndex.set(d, i))

    const map = new Map<string, string>()
    const agoMap = new Map<string, number>()
    for (const row of (data as LastPracticedRow[] | null) ?? []) {
      const shotId = row.shot_id
      const date = row.session?.started_at ?? undefined
      if (!shotId) continue
      if (!date) continue
      const existing = map.get(shotId)
      if (!existing || date > existing) {
        map.set(shotId, date)
        agoMap.set(shotId, dateToIndex.get(date)!)
      }
    }
    setLastPracticedMap(map)
    setLastPracticedSessionAgo(agoMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchLastPracticed()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchLastPracticed])

  return { lastPracticedMap, lastPracticedSessionAgo, loading }
}
