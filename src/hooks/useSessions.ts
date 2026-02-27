import { useEffect, useState } from 'react'
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

/** Fetch all session blocks for a given shot, newest first */
export function useShotSessionHistory(shotId: string | undefined) {
  const [entries, setEntries] = useState<ShotSessionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shotId) return
    fetchHistory(shotId)
  }, [shotId])

  async function fetchHistory(id: string) {
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
    const entries: ShotSessionEntry[] = (data ?? []).map((row: any) => ({
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
  }

  return { entries, loading }
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
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
  }

  return { sessions, loading, refetch: fetchSessions }
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLastPracticed()
  }, [])

  async function fetchLastPracticed() {
    setLoading(true)
    // Get all session blocks with their session dates, grouped by shot_id
    const { data } = await supabase
      .from('session_blocks')
      .select('shot_id, session:sessions(started_at)')
      .not('shot_id', 'is', null)

    const map = new Map<string, string>()
    for (const row of data ?? []) {
      const shotId = row.shot_id as string
      const date = (row.session as any)?.started_at as string | undefined
      if (!date) continue
      const existing = map.get(shotId)
      if (!existing || date > existing) {
        map.set(shotId, date)
      }
    }
    setLastPracticedMap(map)
    setLoading(false)
  }

  return { lastPracticedMap, loading }
}
