import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '../types'

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
