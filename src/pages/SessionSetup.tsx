import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useShots } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { getSessionCount } from '../hooks/useSessions'
import { createSession, createSessionBlocks } from '../hooks/useSession'
import { planSession } from '../lib/session-planner'
import { prioritizeShots } from '../lib/scoring'
import { getImageUrl } from '../lib/supabase'
import type { PlanBlock } from '../lib/session-planner'
import type { Shot } from '../types'

export function SessionSetup() {
  const { shots, loading: shotsLoading } = useShots()
  const { assessments, loading: assessLoading } = useAssessments()
  const [minutes, setMinutes] = useState(90)
  const [sessionNumber, setSessionNumber] = useState<number | null>(null)
  const [plan, setPlan] = useState<PlanBlock[] | null>(null)
  const [starting, setStarting] = useState(false)
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const navigate = useNavigate()

  const loading = shotsLoading || assessLoading

  // Auto-derive session number from past session count
  useEffect(() => {
    getSessionCount().then((count) => {
      setSessionNumber(count + 1)
    })
  }, [])

  function handleGenerate() {
    if (sessionNumber === null) return
    const result = planSession({ shots, assessments, minutes, sessionNumber })
    setPlan(result.blocks)
    setSwappingIndex(null)
  }

  // Get all active shots not currently in the plan, for swap picker
  function getAvailableShots(): Shot[] {
    if (!plan) return []
    const usedIds = new Set(
      plan.filter((b) => b.shot).map((b) => b.shot!.id)
    )
    const prioritized = prioritizeShots(shots, assessments)
    return prioritized
      .filter((s) => !usedIds.has(s.shot.id))
      .map((s) => s.shot)
  }

  function handleSwapShot(blockIndex: number, newShot: Shot) {
    if (!plan) return
    const oldShotId = plan[blockIndex].shot?.id
    const updated = plan.map((block) => {
      if (block.shot?.id === oldShotId) {
        const typeLabel =
          block.blockType === 'core'
            ? 'Core reps'
            : 'Reinforcement'
        return {
          ...block,
          shot: newShot,
          label: `${typeLabel}: ${newShot.title}`,
        }
      }
      return block
    })
    setPlan(updated)
    setSwappingIndex(null)
  }

  async function handleStart() {
    if (!plan) return
    setStarting(true)

    const { data: session, error: sessionErr } = await createSession(minutes)
    if (sessionErr || !session) {
      setStarting(false)
      return
    }

    const blocks = plan.map((b, i) => ({
      shot_id: b.shot?.id ?? null,
      shot_image_id: null,
      block_type: b.blockType,
      duration_minutes: b.durationMinutes,
      attempts: 0,
      successes: 0,
      comfort_rating: null,
      notes: null,
      sort_order: i,
    }))

    await createSessionBlocks(session.id, blocks)
    navigate(`/session/${session.id}`)
  }

  const availableShots = getAvailableShots()

  function getPrimaryImage(shot: Shot) {
    return shot.images?.find((i) => i.is_primary) ?? shot.images?.[0]
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Plan a Session</h1>

      {/* Session info */}
      <div className="p-3 rounded-lg bg-surface-secondary border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-secondary">
            This will be session{' '}
            <span className="font-semibold text-on-surface">
              #{sessionNumber ?? '...'}
            </span>{' '}
            in your training plan
          </span>
        </div>
        <p className="text-xs text-on-surface-secondary mt-1">
          Shot selection is based on your assessment scores and spaced repetition schedule.
        </p>
      </div>

      <div>
        <label className="text-sm text-on-surface-secondary block mb-1">
          Duration (min)
        </label>
        <div className="flex gap-2">
          {[30, 60, 90, 120].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                minutes === m
                  ? 'border-accent bg-accent/10 text-accent font-medium'
                  : 'border-border text-on-surface-secondary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
          className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
          placeholder="Custom duration"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || sessionNumber === null}
        className="w-full py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
      </button>

      {plan && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-on-surface-secondary">
            Session Plan ({minutes} min)
          </h2>

          {plan.map((block, i) => {
            const isShotBlock = block.phase === 'shot-work' && block.shot
            const isSwapping = swappingIndex === i
            const img = block.shot ? getPrimaryImage(block.shot) : null

            return (
              <div key={i}>
                <div
                  className={`p-3 rounded-lg border text-sm ${
                    block.phase === 'warmup'
                      ? 'border-warning/30 bg-warning/5'
                      : block.phase === 'cooldown'
                        ? 'border-accent/30 bg-accent/5'
                        : 'border-border bg-surface-secondary'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Shot thumbnail */}
                    {isShotBlock && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-black overflow-hidden shrink-0">
                        {img ? (
                          <img
                            src={getImageUrl(img.storage_path)}
                            alt={block.shot!.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                            No img
                          </div>
                        )}
                      </div>
                    )}

                    {/* Block details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="font-medium truncate">{block.label}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="text-xs text-on-surface-secondary whitespace-nowrap">
                            {block.durationMinutes} min
                          </span>
                          {isShotBlock && (
                            <button
                              onClick={() => setSwappingIndex(isSwapping ? null : i)}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                isSwapping
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-accent/30 text-accent hover:bg-accent/5'
                              }`}
                            >
                              {isSwapping ? 'Cancel' : 'Swap'}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-secondary mt-1 line-clamp-2">
                        {block.focus}
                      </p>
                      {block.spacingNote && (
                        <p className="text-xs text-on-surface-secondary italic mt-0.5">
                          {block.spacingNote}
                        </p>
                      )}
                      {/* Show variation count */}
                      {block.shot?.images && block.shot.images.length > 1 && (
                        <p className="text-xs text-accent mt-1">
                          {block.shot.images.length} variations available
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Swap picker */}
                {isSwapping && (
                  <div className="mt-1 p-3 rounded-lg border border-accent/30 bg-accent/5">
                    <p className="text-xs font-semibold text-accent mb-2">
                      Replace with:
                    </p>
                    {availableShots.length === 0 ? (
                      <p className="text-xs text-on-surface-secondary">
                        No other shots available to swap in.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {availableShots.map((shot) => {
                          const shotImg = getPrimaryImage(shot)
                          return (
                            <button
                              key={shot.id}
                              onClick={() => handleSwapShot(i, shot)}
                              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm border border-border bg-surface hover:border-accent hover:bg-accent/5 transition-colors"
                            >
                              <div className="w-10 h-10 rounded-lg bg-black overflow-hidden shrink-0">
                                {shotImg ? (
                                  <img
                                    src={getImageUrl(shotImg.storage_path)}
                                    alt={shot.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px]">
                                    —
                                  </div>
                                )}
                              </div>
                              <span className="truncate">{shot.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-3 bg-success text-white rounded-lg font-semibold hover:bg-success/90 transition-colors disabled:opacity-50"
          >
            {starting ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      )}
    </div>
  )
}
