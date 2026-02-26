import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useShots } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { createSession, createSessionBlocks } from '../hooks/useSession'
import { planSession } from '../lib/session-planner'
import type { PlanBlock } from '../lib/session-planner'

export function SessionSetup() {
  const { shots, loading: shotsLoading } = useShots()
  const { assessments, loading: assessLoading } = useAssessments()
  const [minutes, setMinutes] = useState(90)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [plan, setPlan] = useState<PlanBlock[] | null>(null)
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()

  const loading = shotsLoading || assessLoading

  function handleGenerate() {
    const result = planSession({ shots, assessments, minutes, sessionNumber })
    setPlan(result.blocks)
  }

  async function handleStart() {
    if (!plan) return
    setStarting(true)

    const { data: session, error: sessionErr } = await createSession(minutes)
    if (sessionErr || !session) {
      setStarting(false)
      return
    }

    const blocks = plan.map((b) => ({
      shot_id: b.shot?.id ?? null,
      block_type: b.blockType,
      duration_minutes: b.durationMinutes,
      attempts: 0,
      successes: 0,
      comfort_rating: null,
      notes: null,
      sort_order: 0,
    }))

    await createSessionBlocks(session.id, blocks)
    navigate(`/session/${session.id}`)
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Plan a Session</h1>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Duration (min)
          </label>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Session #
          </label>
          <input
            type="number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Generate Plan'}
      </button>

      {plan && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-on-surface-secondary">
            Session Plan ({minutes} min)
          </h2>

          {plan.map((block, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-sm ${
                block.phase === 'warmup'
                  ? 'border-warning/30 bg-warning/5'
                  : block.phase === 'cooldown'
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-border bg-surface-secondary'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium">{block.label}</span>
                <span className="text-xs text-on-surface-secondary ml-2 whitespace-nowrap">
                  {block.durationMinutes} min
                </span>
              </div>
              <p className="text-xs text-on-surface-secondary mt-1">
                {block.focus}
              </p>
              {block.spacingNote && (
                <p className="text-xs text-on-surface-secondary italic mt-0.5">
                  {block.spacingNote}
                </p>
              )}
            </div>
          ))}

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
