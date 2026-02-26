import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Shot } from '../types'

export function useShots() {
  const [shots, setShots] = useState<Shot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShots()
  }, [])

  async function fetchShots() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('shots')
      .select(`
        *,
        images:shot_images(*),
        variations:shot_variations(*, image:shot_images(*)),
        tags:shot_tags(tag:tags(*))
      `)
      .order('title')

    if (err) {
      setError(err.message)
    } else {
      const mapped = (data ?? []).map((s) => ({
        ...s,
        tags: s.tags?.map((st: { tag: { id: string; name: string } }) => st.tag) ?? [],
      }))
      setShots(mapped)
    }
    setLoading(false)
  }

  return { shots, loading, error, refetch: fetchShots }
}

export function useShot(slug: string | undefined) {
  const [shot, setShot] = useState<Shot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetchShot(slug)
  }, [slug])

  async function fetchShot(slugParam?: string) {
    const s = slugParam ?? slug
    if (!s) return
    setLoading(true)
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
      setShot({
        ...data,
        tags: data.tags?.map((st: { tag: { id: string; name: string } }) => st.tag) ?? [],
      })
    }
    setLoading(false)
  }

  return { shot, loading, error, refetch: fetchShot }
}
