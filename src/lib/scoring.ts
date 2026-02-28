import type { Assessment, Shot } from '../types'

/**
 * Compute the aggregate skill score from assessment dimensions.
 *
 * Rules:
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
 * Frequency-adjusted spaced repetition period.
 *
 * Tuned for 2–4 shots per session from a library of ~20 active shots.
 * No shot appears every session — even the weakest get at least one gap.
 *
 *   Score 1 + freq 3 → 2,  Score 1 + freq 2 → 3,  Score 1 + freq 1 → 5
 *   Score 2 + freq 3 → 4,  Score 2 + freq 2 → 5,  Score 2 + freq 1 → 8
 *   Score 3 + freq 3 → 6,  Score 3 + freq 2 → 8,  Score 3 + freq 1 → 12
 */
export function spacedPeriod(aggregateScore: number, frequency: number = 2): number {
  const basePeriod = [3, 5, 8] // indexed by score - 1
  const freqScale = [1.5, 1.0, 0.7] // indexed by 3 - frequency (so freq 3 = 0.7x = tighter)
  const base = basePeriod[Math.min(Math.max(aggregateScore, 1), 3) - 1]
  const scale = freqScale[Math.min(Math.max(3 - frequency, 0), 2)]
  return Math.max(1, Math.round(base * scale))
}

/**
 * Whether a shot is due for review in the given session number.
 */
export function isDueForSession(
  aggregateScore: number,
  sessionNumber: number,
  frequency: number = 2
): boolean {
  const period = spacedPeriod(aggregateScore, frequency)
  return (sessionNumber - 1) % period === 0
}

/**
 * Composite priority score: combines skill weakness with real-world frequency.
 * Higher = more urgent.
 *
 *   (4 - score) * 2 + frequency
 *   Range: 3 (proficient + rare) to 9 (weak + common)
 */
export function priorityScore(aggregateScore: number, frequency: number): number {
  return (4 - aggregateScore) * 2 + frequency
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

/** Next session number where a shot is due for review. */
export function nextDueSession(s: ShotWithScore, sessionNumber: number): number {
  const period = spacedPeriod(s.aggregateScore, s.shot.frequency)
  for (let n = sessionNumber; n < sessionNumber + period; n++) {
    if (isDueForSession(s.aggregateScore, n, s.shot.frequency)) return n
  }
  return sessionNumber + period
}

/** Sort shots by rotation schedule: due date → priority → alpha. */
export function sortByRotation(shots: ShotWithScore[], sessionNumber: number): ShotWithScore[] {
  return [...shots].sort((a, b) => {
    const aDue = nextDueSession(a, sessionNumber)
    const bDue = nextDueSession(b, sessionNumber)
    if (aDue !== bDue) return aDue - bDue
    if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore
    return a.shot.title.localeCompare(b.shot.title)
  })
}

export interface ShotWithScore {
  shot: Shot
  aggregateScore: number
  latestAssessment: Assessment | null
  lastPracticedAt: string | null
  sessionsAgo: number | null
  priorityScore: number
  isAssessed: boolean
}

/**
 * Prioritize shots for training using the v2 algorithm:
 *
 * 1. Unassessed shots first (sub-sort: least recently practiced, frequency DESC, alpha)
 * 2. Composite priority score DESC (combines skill + frequency)
 * 3. Least recently practiced first (recency tiebreaker)
 * 4. Alphabetical
 *
 * @param lastPracticedMap - optional map of shot_id → ISO date string of last practice
 * @param sessionsAgoMap - optional map of shot_id → number of sessions since last practiced
 */
export function prioritizeShots(
  shots: Shot[],
  assessments: Assessment[],
  lastPracticedMap?: Map<string, string>,
  sessionsAgoMap?: Map<string, number>
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
      const aggregateScore = latest ? latest.aggregate_score : 2
      const isAssessed = latest !== null
      const lastPracticedAt = lastPracticedMap?.get(shot.id) ?? null
      const sessionsAgo = sessionsAgoMap?.get(shot.id) ?? null
      return {
        shot,
        aggregateScore,
        latestAssessment: latest,
        lastPracticedAt,
        sessionsAgo,
        priorityScore: priorityScore(aggregateScore, shot.frequency),
        isAssessed,
      }
    })

  scored.sort((a, b) => {
    // 1. Unassessed shots first
    if (a.isAssessed !== b.isAssessed) return a.isAssessed ? 1 : -1

    // For unassessed: most sessions ago first, then frequency DESC, then alpha
    if (!a.isAssessed && !b.isAssessed) {
      if (a.sessionsAgo !== b.sessionsAgo) {
        if (a.sessionsAgo === null) return -1
        if (b.sessionsAgo === null) return 1
        return b.sessionsAgo - a.sessionsAgo
      }
      if (a.shot.frequency !== b.shot.frequency)
        return b.shot.frequency - a.shot.frequency
      return a.shot.title.localeCompare(b.shot.title)
    }

    // 2. Priority score DESC (higher = more urgent)
    if (a.priorityScore !== b.priorityScore)
      return b.priorityScore - a.priorityScore

    // 3. Most sessions ago first (null = never practiced = top)
    if (a.sessionsAgo !== b.sessionsAgo) {
      if (a.sessionsAgo === null) return -1
      if (b.sessionsAgo === null) return 1
      return b.sessionsAgo - a.sessionsAgo
    }

    // 4. Alphabetical
    return a.shot.title.localeCompare(b.shot.title)
  })

  return scored
}
