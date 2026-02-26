import type { Shot, Assessment } from '../types'
import { prioritizeShots, isDueForSession, focusHint, type ShotWithScore } from './scoring'

const SHOTS_PER_MINUTE = 2
const TARGET_BLOCK_MINUTES = 20
const DEFAULT_WARMUP = 10
const DEFAULT_COOLDOWN = 10

export interface PlanBlock {
  phase: 'warmup' | 'shot-work' | 'cooldown'
  blockType: 'warmup' | 'core' | 'variant' | 'reinforcement' | 'cooldown'
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

export function planSession({
  shots,
  assessments,
  minutes = 90,
  sessionNumber = 1,
}: {
  shots: Shot[]
  assessments: Assessment[]
  minutes?: number
  sessionNumber?: number
}): SessionPlan {
  const totalMinutes = Math.max(1, minutes)
  const prioritized = prioritizeShots(shots, assessments)

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
    isDueForSession(s.aggregateScore, sessionNumber)
  )
  const backfill = prioritized.filter(
    (s) => !isDueForSession(s.aggregateScore, sessionNumber)
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
    type: 'core' | 'variant' | 'reinforcement',
    duration: number
  ): PlanBlock {
    const assessment = scored.latestAssessment
    let focus = ''
    if (assessment) {
      const hint = focusHint(assessment)
      if (type === 'variant') focus = `Variant block (change speed/angle/spin). ${hint}`
      else if (type === 'reinforcement') focus = `Reinforce feel under fatigue. ${hint}`
      else focus = `Same-instance reps. ${hint}`
    } else {
      focus =
        type === 'variant'
          ? 'Variant block: explore different angles and speeds.'
          : type === 'reinforcement'
            ? 'Reinforcement: repeat best layout.'
            : 'First assessment needed — focus on getting comfortable.'
    }

    const period = Math.max(1, scored.aggregateScore)
    const spacingNote = `Every ${period} session(s); next revisit session ${sessionNumber + period}`

    const labels: Record<string, string> = {
      core: 'Core reps',
      variant: 'Variant exploration',
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

  // Recommend 2 shot types (or 1 if only 1 available)
  const recommendedCount = Math.min(2, queue.length)

  // First pass: core reps for each recommended shot
  while (practiceMinutes > 0 && foundationTargets.length < recommendedCount) {
    const scored = nextShot()
    if (!scored) break
    usedIds.add(scored.shot.id)
    const duration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
    blocks.push(makeShotBlock(scored, 'core', duration))
    foundationTargets.push(scored)
    practiceMinutes -= duration
  }

  // Second pass: variant blocks
  for (const scored of foundationTargets) {
    if (practiceMinutes <= 0) break
    const duration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
    blocks.push(makeShotBlock(scored, 'variant', duration))
    practiceMinutes -= duration
  }

  // Fill remaining time with more shots or reinforcement
  while (practiceMinutes > 0) {
    const scored = nextShot()
    if (scored) {
      usedIds.add(scored.shot.id)
      const duration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
      blocks.push(makeShotBlock(scored, 'core', duration))
      foundationTargets.push(scored)
      practiceMinutes -= duration
      if (practiceMinutes > 0) {
        const varDuration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
        blocks.push(makeShotBlock(scored, 'variant', varDuration))
        practiceMinutes -= varDuration
      }
    } else {
      if (foundationTargets.length === 0) break
      const duration = Math.min(TARGET_BLOCK_MINUTES, practiceMinutes)
      blocks.push(makeShotBlock(foundationTargets[0], 'reinforcement', duration))
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
