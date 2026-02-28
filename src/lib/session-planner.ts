import type { Shot, Assessment } from '../types'
import { prioritizeShots, sortByRotation, spacedPeriod, focusHint, type ShotWithScore } from './scoring'

const SHOTS_PER_MINUTE = 2
const BLOCK_MINUTES = 20
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

/** Number of core shots that fit in the given practice time. */
function coreSlotCount(practiceMinutes: number): number {
  return Math.floor(practiceMinutes / BLOCK_MINUTES)
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

  // Sort by rotation order (same as dashboard): due date → priority → alpha.
  const queue = sortByRotation(prioritized, sessionNumber)

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
      if (type === 'reinforcement') focus = `Quick review — stay sharp. ${hint}`
      else focus = `Same-instance reps. ${hint}`
    } else {
      focus =
        type === 'reinforcement'
          ? 'Quick review — get a feel for this shot.'
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

  // Core blocks: each shot gets a fixed 20-min block.
  const coreCount = Math.min(coreSlotCount(practiceMinutes), queue.length)

  for (let i = 0; i < coreCount; i++) {
    const scored = nextShot()
    if (!scored) break
    usedIds.add(scored.shot.id)
    blocks.push(makeShotBlock(scored, 'core', BLOCK_MINUTES))
    foundationTargets.push(scored)
    practiceMinutes -= BLOCK_MINUTES
  }

  // Reinforcement: if there's remainder time (practiceMinutes % 20), add one
  // bonus shot as a quick review. Draws from the same rotation-sorted queue
  // so the pick matches the dashboard order.
  if (practiceMinutes > 0) {
    const bonus = nextShot()
    if (bonus) {
      usedIds.add(bonus.shot.id)
      blocks.push(makeShotBlock(bonus, 'reinforcement', practiceMinutes))
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
