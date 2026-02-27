import type { Shot, Assessment } from '../types'
import { prioritizeShots, isDueForSession, spacedPeriod, focusHint, type ShotWithScore } from './scoring'

const SHOTS_PER_MINUTE = 2
const TARGET_BLOCK_MINUTES = 15
const DEFAULT_WARMUP = 10
const DEFAULT_COOLDOWN = 10

export interface PlanBlock {
  phase: 'warmup' | 'shot-work' | 'cooldown'
  blockType: 'warmup' | 'core' | 'reinforcement' | 'cooldown'
  label: string
  shot: Shot | null
  durationMinutes: number
  shotsPlanned: number
  focus: string
  spacingNote: string
}

export interface SessionPlan {
  blocks: PlanBlock[]
  totalMinutes: number
  sessionNumber: number
}

/**
 * Compute block duration scaled by shot frequency.
 * High-freq shots get ~40% longer blocks.
 *
 *   freq 1 → target * 1.0
 *   freq 2 → target * 1.2
 *   freq 3 → target * 1.4
 */
function frequencyBlockMinutes(frequency: number, remaining: number): number {
  const scaled = Math.round(TARGET_BLOCK_MINUTES * (0.8 + frequency * 0.2))
  return Math.min(scaled, remaining)
}

export function planSession({
  shots,
  assessments,
  minutes = 90,
  sessionNumber = 1,
  lastPracticedMap,
}: {
  shots: Shot[]
  assessments: Assessment[]
  minutes?: number
  sessionNumber?: number
  lastPracticedMap?: Map<string, string>
}): SessionPlan {
  const totalMinutes = Math.max(1, minutes)
  const prioritized = prioritizeShots(shots, assessments, lastPracticedMap)

  // Compute warmup/cooldown, scaling down for short sessions
  let warmMinutes = DEFAULT_WARMUP
  let coolMinutes = DEFAULT_COOLDOWN
  const bufferTotal = DEFAULT_WARMUP + DEFAULT_COOLDOWN

  if (totalMinutes < bufferTotal) {
    const scale = totalMinutes / bufferTotal
    warmMinutes = Math.max(1, Math.round(DEFAULT_WARMUP * scale))
    coolMinutes = Math.max(1, Math.round(DEFAULT_COOLDOWN * scale))
    while (warmMinutes + coolMinutes > totalMinutes) {
      if (coolMinutes >= warmMinutes && coolMinutes > 1) coolMinutes--
      else if (warmMinutes > 1) warmMinutes--
      else break
    }
  }

  let practiceMinutes = Math.max(0, totalMinutes - warmMinutes - coolMinutes)

  // Filter eligible shots for this session based on spaced repetition
  const eligible = prioritized.filter((s) =>
    isDueForSession(s.aggregateScore, sessionNumber, s.shot.frequency)
  )
  const backfill = prioritized.filter(
    (s) => !isDueForSession(s.aggregateScore, sessionNumber, s.shot.frequency)
  )
  const queue = [...eligible, ...backfill]

  const blocks: PlanBlock[] = []
  const usedIds = new Set<string>()
  const foundationTargets: ShotWithScore[] = []

  // Warmup
  blocks.push({
    phase: 'warmup',
    blockType: 'warmup',
    label: 'Warm-up & mechanics',
    shot: null,
    durationMinutes: warmMinutes,
    shotsPlanned: warmMinutes * SHOTS_PER_MINUTE,
    focus: 'Loosen arm, calibrate cue-ball, rehearse PSR at 2 shots/min.',
    spacingNote: '',
  })

  if (practiceMinutes <= 0) {
    blocks.push(makeCooldown(coolMinutes))
    return { blocks, totalMinutes, sessionNumber }
  }

  function nextShot(): ShotWithScore | null {
    for (let i = 0; i < queue.length; i++) {
      if (!usedIds.has(queue[i].shot.id)) {
        const [item] = queue.splice(i, 1)
        return item
      }
    }
    return null
  }

  function makeShotBlock(
    scored: ShotWithScore,
    type: 'core' | 'reinforcement',
    duration: number
  ): PlanBlock {
    const assessment = scored.latestAssessment
    let focus = ''
    if (assessment) {
      const hint = focusHint(assessment)
      if (type === 'reinforcement') focus = `Reinforce feel under fatigue. ${hint}`
      else focus = `Same-instance reps. ${hint}`
    } else {
      focus =
        type === 'reinforcement'
          ? 'Reinforcement: repeat best layout.'
          : 'First assessment needed — focus on getting comfortable.'
    }

    const period = spacedPeriod(scored.aggregateScore, scored.shot.frequency)
    const spacingNote = `Every ${period} session(s); next revisit session ${sessionNumber + period}`

    const labels: Record<string, string> = {
      core: 'Core reps',
      reinforcement: 'Reinforcement',
    }

    return {
      phase: 'shot-work',
      blockType: type,
      label: `${labels[type]}: ${scored.shot.title}`,
      shot: scored.shot,
      durationMinutes: duration,
      shotsPlanned: duration * SHOTS_PER_MINUTE,
      focus,
      spacingNote,
    }
  }

  // Scale foundation shot count with session duration: max(2, floor(practiceMinutes / 20))
  const recommendedCount = Math.min(
    Math.max(2, Math.floor(practiceMinutes / 20)),
    queue.length
  )

  // First pass: core reps for each foundation shot (frequency-scaled duration)
  while (practiceMinutes > 0 && foundationTargets.length < recommendedCount) {
    const scored = nextShot()
    if (!scored) break
    usedIds.add(scored.shot.id)
    const duration = frequencyBlockMinutes(scored.shot.frequency, practiceMinutes)
    blocks.push(makeShotBlock(scored, 'core', duration))
    foundationTargets.push(scored)
    practiceMinutes -= duration
  }

  // Second pass: reinforcement only for score-1 (weakest) shots
  for (const scored of foundationTargets) {
    if (practiceMinutes <= 0) break
    if (scored.aggregateScore > 1) continue // skip reinforcement for score 2+
    const duration = frequencyBlockMinutes(scored.shot.frequency, practiceMinutes)
    blocks.push(makeShotBlock(scored, 'reinforcement', duration))
    practiceMinutes -= duration
  }

  // Fill remaining time with more shots
  while (practiceMinutes > 0) {
    const scored = nextShot()
    if (scored) {
      usedIds.add(scored.shot.id)
      const duration = frequencyBlockMinutes(scored.shot.frequency, practiceMinutes)
      blocks.push(makeShotBlock(scored, 'core', duration))
      foundationTargets.push(scored)
      practiceMinutes -= duration
    } else {
      // No more shots available — add reinforcement for weakest existing
      const weakest = foundationTargets.find((s) => s.aggregateScore === 1)
        ?? foundationTargets[0]
      if (!weakest) break
      const duration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
      blocks.push(makeShotBlock(weakest, 'reinforcement', duration))
      practiceMinutes -= duration
    }
  }

  // Cooldown
  blocks.push(makeCooldown(coolMinutes))

  return { blocks, totalMinutes, sessionNumber }
}

function makeCooldown(minutes: number): PlanBlock {
  return {
    phase: 'cooldown',
    blockType: 'cooldown',
    label: 'Cool-down & reflection',
    shot: null,
    durationMinutes: minutes,
    shotsPlanned: 0,
    focus: 'Stretch, breathing, capture takeaways.',
    spacingNote: '',
  }
}
