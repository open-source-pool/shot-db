import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useSessionById, updateBlock } from '../hooks/useSession'
import { getImageUrl } from '../lib/supabase'
import { getDefaultVariation } from '../lib/variations'
import { findResumeBlockIndex, sessionTotals } from '../lib/session-helpers'
import type { SessionBlock, ShotVariation } from '../types'

export function SessionActive() {
  const { id } = useParams<{ id: string }>()
  const { session, loading, refetch } = useSessionById(id)
  const navigate = useNavigate()
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const resumeInitialized = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)
  const [editingField, setEditingField] = useState<'attempts' | 'successes' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null)
  const [countPopKey, setCountPopKey] = useState(0)

  // Wall-clock anchors so the timer survives backgrounding / phone lock
  const startedAtRef = useRef(0)
  const pausedElapsedRef = useRef(0)

  // Timer — uses wall-clock diff instead of counter increment
  useEffect(() => {
    if (running) {
      startedAtRef.current = Date.now()
      const tick = () => {
        const nextElapsed =
          pausedElapsedRef.current
          + Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(nextElapsed)
      }
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else {
      const nextElapsed =
        pausedElapsedRef.current
        + Math.floor((Date.now() - startedAtRef.current) / 1000)
      pausedElapsedRef.current = nextElapsed
      setElapsed(nextElapsed)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  // Recalculate immediately when tab regains visibility (phone unlock / tab switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && running) {
        const nextElapsed =
          pausedElapsedRef.current
          + Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(nextElapsed)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [running])

  // On load, auto-advance to the first block with 0 attempts (resume support)
  useEffect(() => {
    if (!session || resumeInitialized.current) return
    resumeInitialized.current = true
    const idx = findResumeBlockIndex(session.blocks ?? [])
    if (idx > 0) setCurrentBlockIndex(idx)
  }, [session])

  // Reset selected variation when block changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!session) return
      const blocks = session.blocks ?? []
      const block = blocks[currentBlockIndex]
      if (block?.shot_variation_id) {
        setSelectedVariationId(block.shot_variation_id)
      } else if (block?.shot) {
        const defaultVar = getDefaultVariation(block.shot)
        setSelectedVariationId(defaultVar?.id ?? null)
      } else {
        setSelectedVariationId(null)
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [currentBlockIndex, session])

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
        <div className="flex gap-3 justify-center">
          <Link
            to={`/session/${id}/review`}
            className="px-4 py-2 bg-accent text-white rounded-lg"
          >
            Review Session
          </Link>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-surface-secondary border border-border rounded-lg"
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  const shot = block.shot
  const variations = shot?.variations ?? []
  const currentVariation = variations.find((v) => v.id === selectedVariationId)
    ?? variations.find((v) => v.is_default)
    ?? variations[0]
  const currentImage = currentVariation?.image ?? null
  const blockDurationSec = block.duration_minutes * 60

  // Calculate cumulative time for current block
  let priorMinutes = 0
  for (let i = 0; i < currentBlockIndex; i++) {
    priorMinutes += blocks[i].duration_minutes
  }
  const blockElapsed = elapsed - priorMinutes * 60
  const blockRemaining = Math.max(0, blockDurationSec - blockElapsed)

  async function selectVariation(variation: ShotVariation) {
    if (!block) return
    setSelectedVariationId(variation.id)
    await updateBlock(block.id, { shot_variation_id: variation.id })
    refetch()
  }

  async function recordAttempt(success: boolean) {
    if (!block) return
    const updates: Partial<Pick<SessionBlock, 'attempts' | 'successes'>> = {
      attempts: (block.attempts ?? 0) + 1,
    }
    if (success) {
      updates.successes = (block.successes ?? 0) + 1
    }
    await updateBlock(block.id, updates)
    setCountPopKey((k) => k + 1)
    refetch()
  }

  async function handleEditSave() {
    if (!block || !editingField) return
    const val = Math.max(0, parseInt(editValue) || 0)
    const updates: Partial<Pick<SessionBlock, 'attempts' | 'successes'>> = {}

    if (editingField === 'attempts') {
      // Editing misses: attempts = hits + new misses
      const hits = block.successes ?? 0
      updates.attempts = hits + val
    } else {
      // Editing hits: keep misses the same, recompute attempts
      const misses = (block.attempts ?? 0) - (block.successes ?? 0)
      updates.successes = val
      updates.attempts = val + misses
    }

    await updateBlock(block.id, updates)
    setEditingField(null)
    setEditValue('')
    refetch()
  }

  function startEdit(field: 'attempts' | 'successes') {
    setEditingField(field)
    if (field === 'attempts') {
      // Show current miss count
      setEditValue(String((block?.attempts ?? 0) - (block?.successes ?? 0)))
    } else {
      setEditValue(String(block?.successes ?? 0))
    }
  }

  function prevBlock() {
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex((i) => i - 1)
    }
  }

  function nextBlock() {
    if (currentBlockIndex < blocks.length - 1) {
      setCurrentBlockIndex((i) => i + 1)
    } else {
      setRunning(false)
      setCurrentBlockIndex(blocks.length)
    }
  }

  // Session-wide totals
  const { totalAttempts, totalSuccesses } = sessionTotals(blocks)

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
            onClick={prevBlock}
            disabled={currentBlockIndex === 0}
            className="px-3 py-1 text-sm rounded-lg bg-surface border border-border disabled:opacity-30"
          >
            Prev
          </button>
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
        <div className="aspect-[4/3] sm:aspect-[16/9] max-h-[50vh] bg-black mx-4 rounded-xl overflow-hidden mb-2">
          {currentImage ? (
            <img
              src={getImageUrl(currentImage.storage_path)}
              alt={shot.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              {currentVariation ? currentVariation.title : 'No image'}
            </div>
          )}
        </div>
      )}

      {/* Variation picker */}
      {shot && variations.length > 1 && (
        <div className="mx-4 mb-4">
          <div className="flex gap-2 overflow-x-auto py-1">
            {variations.map((v) => {
              const isSelected = v.id === (selectedVariationId ?? currentVariation?.id)
              return (
                <button
                  key={v.id}
                  onClick={() => selectVariation(v)}
                  className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/5'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {v.image && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-black shrink-0">
                      <img
                        src={getImageUrl(v.image.storage_path)}
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-xs font-medium max-w-[80px] truncate">{v.title}</span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-on-surface-secondary mt-1">
            Tap a variation to practice
          </p>
        </div>
      )}

      <div key={`block-${currentBlockIndex}`} className="px-4 space-y-3 animate-fade-in">
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
            {currentVariation && variations.length > 1 && (
              <> &middot; {currentVariation.title}</>
            )}
          </span>
        </div>

        {/* Record attempts (only for shot blocks) */}
        {shot && (
          <>
            <div className="flex gap-3">
              <button
                onClick={() => recordAttempt(true)}
                className="flex-1 py-4 bg-success/10 text-success font-semibold rounded-xl border border-success/30 text-lg active:scale-95 transition-transform duration-150"
              >
                Hit
              </button>
              <button
                onClick={() => recordAttempt(false)}
                className="flex-1 py-4 bg-danger/10 text-danger font-semibold rounded-xl border border-danger/30 text-lg active:scale-95 transition-transform duration-150"
              >
                Miss
              </button>
            </div>

            <div className="flex justify-around text-center">
              {/* Hits — tap to edit */}
              <button
                onClick={() => startEdit('successes')}
                className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
              >
                {editingField === 'successes' ? (
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleEditSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                      autoFocus
                      className="w-16 text-center text-xl font-bold border border-accent rounded px-1 bg-surface text-on-surface"
                      min={0}
                    />
                    <div className="text-xs text-accent">Enter to save</div>
                  </div>
                ) : (
                  <>
                    <div key={`hits-${countPopKey}`} className="text-2xl font-bold text-success animate-count-pop">{block.successes ?? 0}</div>
                    <div className="text-xs text-on-surface-secondary">Hits</div>
                  </>
                )}
              </button>

              {/* Misses — tap to edit */}
              <button
                onClick={() => startEdit('attempts')}
                className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
              >
                {editingField === 'attempts' ? (
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleEditSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                      autoFocus
                      className="w-16 text-center text-xl font-bold border border-accent rounded px-1 bg-surface text-on-surface"
                      min={0}
                    />
                    <div className="text-xs text-accent">Enter to save</div>
                  </div>
                ) : (
                  <>
                    <div key={`misses-${countPopKey}`} className="text-2xl font-bold text-danger animate-count-pop">{(block.attempts ?? 0) - (block.successes ?? 0)}</div>
                    <div className="text-xs text-on-surface-secondary">Misses</div>
                  </>
                )}
              </button>

              {/* Rate */}
              <div className="p-2">
                <div key={`rate-${countPopKey}`} className="text-2xl font-bold animate-count-pop">
                  {block.attempts
                    ? `${Math.round(((block.successes ?? 0) / block.attempts) * 100)}%`
                    : '—'}
                </div>
                <div className="text-xs text-on-surface-secondary">Rate</div>
              </div>
            </div>

            <p className="text-xs text-on-surface-secondary text-center">
              Tap a number to correct it
            </p>

            {/* Session totals */}
            <div className="text-center text-xs text-on-surface-secondary pt-1 border-t border-border">
              Session: {totalAttempts} attempts, {totalSuccesses} hits
              {totalAttempts > 0 && (
                <> ({Math.round((totalSuccesses / totalAttempts) * 100)}%)</>
              )}
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
