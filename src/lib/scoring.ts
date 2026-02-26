import type { Assessment, Shot } from '../types'

/**
 * Compute the aggregate skill score from assessment dimensions.
 *
 * Rules from the spec:
 * 1. If comfort AND visualization are both at lowest (1) → overall = 1
 * 2. If beautiful stroke OR alignment is incorrect → result doesn't matter → overall = 2
 * 3. Otherwise, result impacts: not good (1) → 2, good (2) → 3
 */
export function computeAggregate(a: {
  comfort_level: number
  visualization: number
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: number
}): 1 | 2 | 3 {
  if (a.comfort_level === 1 && a.visualization === 1) return 1
  if (!a.beautiful_stroke || !a.alignment_correct) return 2
  return a.result === 1 ? 2 : 3
}

/**
 * Spaced repetition period: how many sessions between reviews.
 * Score 1 → every session, 2 → every other, 3 → every third.
 */
export function spacedPeriod(aggregateScore: number): number {
  return Math.max(1, aggregateScore)
}

/**
 * Whether a shot is due for review in the given session number.
 */
export function isDueForSession(
  aggregateScore: number,
  sessionNumber: number
): boolean {
  const period = spacedPeriod(aggregateScore)
  return (sessionNumber - 1) % period === 0
}

/**
 * Generate coaching focus hints based on assessment weaknesses.
 */
export function focusHint(a: {
  comfort_level: number
  visualization: number
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: number
}): string {
  const cues: string[] = []

  if (a.comfort_level === 1 && a.visualization === 1) {
    cues.push('Rehearse picture: pre-shot visualization + aim map')
  }
  if (!a.beautiful_stroke) {
    cues.push('Emphasize smooth stroke; no decel; hold still')
  }
  if (!a.alignment_correct) {
    cues.push('Re-check stance/eye line; ghost-ball to aim')
  }
  if (a.result === 1) {
    cues.push('Slow pace; commit to line before stroke')
  }
  if (cues.length === 0) {
    cues.push('Groove pattern; confirm cue-ball path')
  }

  return cues.join(' | ')
}

export interface ShotWithScore {
  shot: Shot
  aggregateScore: number
  latestAssessment: Assessment | null
}

/**
 * Prioritize shots for training: lower aggregate first, higher frequency next.
 * Shots without assessments are treated as score 1 (highest priority).
 */
export function prioritizeShots(
  shots: Shot[],
  assessments: Assessment[]
): ShotWithScore[] {
  // Build map: shot_id -> latest assessment
  const latestByShot = new Map<string, Assessment>()
  for (const a of assessments) {
    const existing = latestByShot.get(a.shot_id)
    if (!existing || a.assessed_at > existing.assessed_at) {
      latestByShot.set(a.shot_id, a)
    }
  }

  const scored: ShotWithScore[] = shots
    .filter((s) => s.status === 'active')
    .map((shot) => {
      const latest = latestByShot.get(shot.id) ?? null
      const aggregateScore = latest ? latest.aggregate_score : 1
      return { shot, aggregateScore, latestAssessment: latest }
    })

  // Sort: lower aggregate first, higher frequency next, then by title for stability
  scored.sort((a, b) => {
    if (a.aggregateScore !== b.aggregateScore)
      return a.aggregateScore - b.aggregateScore
    if (a.shot.frequency !== b.shot.frequency)
      return b.shot.frequency - a.shot.frequency
    return a.shot.title.localeCompare(b.shot.title)
  })

  return scored
}
