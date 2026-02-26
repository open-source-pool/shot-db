import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useSessionById, updateBlock } from '../hooks/useSession'
import { getImageUrl } from '../lib/supabase'
import type { SessionBlock } from '../types'

export function SessionActive() {
  const { id } = useParams<{ id: string }>()
  const { session, loading, refetch } = useSessionById(id)
  const navigate = useNavigate()
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  // Timer
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  if (loading || !session)
    return <div className="p-4 text-on-surface-secondary">Loading session...</div>

  const blocks = session.blocks ?? []
  const block = blocks[currentBlockIndex] as SessionBlock | undefined

  if (!block) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl font-bold mb-2">Session Complete</h1>
        <p className="text-on-surface-secondary mb-4">
          Total time: {formatTime(elapsed)}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-accent text-white rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const shot = block.shot
  const primaryImage = shot?.images?.find((img) => img.is_primary) ?? shot?.images?.[0]
  const blockDurationSec = block.duration_minutes * 60

  // Calculate cumulative time for current block
  let priorMinutes = 0
  for (let i = 0; i < currentBlockIndex; i++) {
    priorMinutes += blocks[i].duration_minutes
  }
  const blockElapsed = elapsed - priorMinutes * 60
  const blockRemaining = Math.max(0, blockDurationSec - blockElapsed)

  async function recordAttempt(success: boolean) {
    if (!block) return
    const updates: Partial<Pick<SessionBlock, 'attempts' | 'successes'>> = {
      attempts: (block.attempts ?? 0) + 1,
    }
    if (success) {
      updates.successes = (block.successes ?? 0) + 1
    }
    await updateBlock(block.id, updates)
    refetch()
  }

  function nextBlock() {
    if (currentBlockIndex < blocks.length - 1) {
      setCurrentBlockIndex((i) => i + 1)
    } else {
      setRunning(false)
      setCurrentBlockIndex(blocks.length) // triggers complete view
    }
  }

  return (
    <div className="pb-4">
      {/* Timer bar */}
      <div className="px-4 py-3 bg-surface-secondary border-b border-border flex items-center justify-between">
        <div>
          <span className="text-2xl font-mono font-bold">{formatTime(blockRemaining)}</span>
          <span className="text-xs text-on-surface-secondary ml-2">remaining</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="px-3 py-1 text-sm rounded-lg bg-surface border border-border"
          >
            {running ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={nextBlock}
            className="px-3 py-1 text-sm rounded-lg bg-accent text-white"
          >
            Next
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between text-xs text-on-surface-secondary">
        <span>
          Block {currentBlockIndex + 1} of {blocks.length}
        </span>
        <span>Total: {formatTime(elapsed)}</span>
      </div>
      <div className="mx-4 h-1 bg-surface-secondary rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${((currentBlockIndex + 1) / blocks.length) * 100}%` }}
        />
      </div>

      {/* Shot image */}
      {shot && (
        <div className="aspect-[4/3] bg-black mx-4 rounded-xl overflow-hidden mb-4">
          {primaryImage ? (
            <img
              src={getImageUrl(primaryImage.storage_path)}
              alt={shot.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No image
            </div>
          )}
        </div>
      )}

      <div className="px-4 space-y-3">
        {/* Block info */}
        <div>
          <h2 className="font-semibold text-lg">
            {block.block_type === 'warmup'
              ? 'Warm-up'
              : block.block_type === 'cooldown'
                ? 'Cool-down'
                : shot?.title ?? 'Practice'}
          </h2>
          <span className="text-xs text-on-surface-secondary capitalize">
            {block.block_type} &middot; {block.duration_minutes} min
          </span>
        </div>

        {/* Record attempts (only for shot blocks) */}
        {shot && (
          <>
            <div className="flex gap-3">
              <button
                onClick={() => recordAttempt(true)}
                className="flex-1 py-4 bg-success/10 text-success font-semibold rounded-xl border border-success/30 text-lg active:bg-success/20"
              >
                Hit
              </button>
              <button
                onClick={() => recordAttempt(false)}
                className="flex-1 py-4 bg-danger/10 text-danger font-semibold rounded-xl border border-danger/30 text-lg active:bg-danger/20"
              >
                Miss
              </button>
            </div>

            <div className="flex justify-around text-center">
              <div>
                <div className="text-2xl font-bold">{block.attempts ?? 0}</div>
                <div className="text-xs text-on-surface-secondary">Attempts</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">{block.successes ?? 0}</div>
                <div className="text-xs text-on-surface-secondary">Hits</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {block.attempts
                    ? `${Math.round(((block.successes ?? 0) / block.attempts) * 100)}%`
                    : '—'}
                </div>
                <div className="text-xs text-on-surface-secondary">Rate</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
