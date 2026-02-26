import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, SessionBlock } from '../types'

export function useSessionById(sessionId: string | undefined) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    fetchSession(sessionId)
  }, [sessionId])

  async function fetchSession(id: string) {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select(`
        *,
        blocks:session_blocks(
          *,
          shot:shots(*, images:shot_images(*)),
          shot_image:shot_images(*)
        )
      `)
      .eq('id', id)
      .single()

    if (data) {
      setSession({
        ...data,
        blocks: (data.blocks ?? []).sort(
          (a: SessionBlock, b: SessionBlock) => a.sort_order - b.sort_order
        ),
      })
    }
    setLoading(false)
  }

  return { session, loading, refetch: () => sessionId && fetchSession(sessionId) }
}

export async function createSession(durationMinutes: number) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ duration_minutes: durationMinutes })
    .select()
    .single()

  return { data, error }
}

export async function createSessionBlocks(
  sessionId: string,
  blocks: Omit<SessionBlock, 'id' | 'session_id'>[]
) {
  const rows = blocks.map((b, i) => ({
    session_id: sessionId,
    shot_id: b.shot_id,
    shot_image_id: b.shot_image_id ?? null,
    block_type: b.block_type,
    duration_minutes: b.duration_minutes,
    attempts: b.attempts,
    successes: b.successes,
    comfort_rating: b.comfort_rating,
    notes: b.notes,
    sort_order: i,
  }))

  const { error } = await supabase.from('session_blocks').insert(rows)
  return { error }
}

export async function updateBlock(
  blockId: string,
  updates: Partial<Pick<SessionBlock, 'attempts' | 'successes' | 'comfort_rating' | 'notes' | 'shot_image_id'>>
) {
  const { error } = await supabase
    .from('session_blocks')
    .update(updates)
    .eq('id', blockId)

  return { error }
}
