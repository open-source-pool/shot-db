import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Assessment } from '../types'
import { computeAggregate } from '../lib/scoring'

export function useAssessments(shotId?: string) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssessments()
  }, [shotId])

  async function fetchAssessments() {
    setLoading(true)
    let query = supabase
      .from('assessments')
      .select('*')
      .order('assessed_at', { ascending: false })

    if (shotId) {
      query = query.eq('shot_id', shotId)
    }

    const { data } = await query
    setAssessments(data ?? [])
    setLoading(false)
  }

  return { assessments, loading, refetch: fetchAssessments }
}

export async function createAssessment(values: {
  shot_id: string
  comfort_level: number
  visualization: number
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: number
  notes?: string
}) {
  const aggregate = computeAggregate(values)

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      ...values,
      aggregate_score: aggregate,
    })
    .select()
    .single()

  return { data, error }
}
