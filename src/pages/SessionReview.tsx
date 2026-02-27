import { useState } from 'react'
import { Link } from 'react-router'
import { useSessionById, updateBlock } from '../hooks/useSession'
import { supabase } from '../lib/supabase'
import { getImageUrl } from '../lib/supabase'
import { getDefaultVariation } from '../lib/variations'
import type { SessionBlock } from '../types'

interface SessionReviewProps {
  sessionId?: string
}

export function SessionReview({ sessionId }: SessionReviewProps) {
  const id = sessionId
  const { session, loading, refetch } = useSessionById(id)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ attempts: 0, successes: 0, notes: '' })
  const [savingNotes, setSavingNotes] = useState(false)
  const [sessionNotes, setSessionNotes] = useState<string | null>(null)

  if (loading || !session)
    return <div className="p-4 text-on-surface-secondary">Loading...</div>

  // Initialize session notes from data
  if (sessionNotes === null && session.notes !== undefined) {
    setSessionNotes(session.notes ?? '')
  }

  const blocks = session.blocks ?? []
  const shotBlocks = blocks.filter(
    (b) => b.block_type !== 'warmup' && b.block_type !== 'cooldown'
  )
  const totalAttempts = shotBlocks.reduce((s, b) => s + (b.attempts ?? 0), 0)
  const totalSuccesses = shotBlocks.reduce((s, b) => s + (b.successes ?? 0), 0)
  const rate = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : null

  function startEdit(block: SessionBlock) {
    setEditingBlock(block.id)
    setEditForm({
      attempts: block.attempts ?? 0,
      successes: block.successes ?? 0,
      notes: block.notes ?? '',
    })
  }

  async function saveEdit() {
    if (!editingBlock) return
    await updateBlock(editingBlock, {
      attempts: editForm.attempts,
      successes: Math.min(editForm.successes, editForm.attempts),
      notes: editForm.notes || null,
    })
    setEditingBlock(null)
    refetch()
  }

  async function saveSessionNotes() {
    if (!session) return
    setSavingNotes(true)
    await supabase
      .from('sessions')
      .update({ notes: sessionNotes || null })
      .eq('id', session.id)
    setSavingNotes(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/sessions" className="text-accent text-sm">&larr; History</Link>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">Session Review</h1>
          <span className="text-sm text-on-surface-secondary">
            {new Date(session.started_at).toLocaleDateString()} &middot;{' '}
            {session.duration_minutes} min
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-border bg-surface-secondary text-center">
          <div className="text-xl font-bold">{totalAttempts}</div>
          <div className="text-xs text-on-surface-secondary">Attempts</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-surface-secondary text-center">
          <div className="text-xl font-bold text-success">{totalSuccesses}</div>
          <div className="text-xs text-on-surface-secondary">Hits</div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-surface-secondary text-center">
          <div className="text-xl font-bold">{rate !== null ? `${rate}%` : '—'}</div>
          <div className="text-xs text-on-surface-secondary">Rate</div>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-on-surface-secondary">Blocks</h2>

        {blocks.map((block) => {
          const shot = block.shot
          // Use the practiced variation's image, falling back to default variation, then legacy images
          const variation = block.shot_variation ?? (shot ? getDefaultVariation(shot) : null)
          const variationImage = variation?.image ?? null
          const primaryImage = variationImage ?? shot?.images?.find((i) => i.is_primary) ?? shot?.images?.[0]
          const isEditing = editingBlock === block.id

          return (
            <div
              key={block.id}
              className={`p-3 rounded-xl border text-sm ${
                block.block_type === 'warmup' || block.block_type === 'cooldown'
                  ? 'border-border/50 bg-surface-secondary/50'
                  : 'border-border bg-surface-secondary'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Shot thumbnail */}
                {primaryImage && (
                  <div className="w-14 h-14 rounded-lg bg-black overflow-hidden shrink-0">
                    <img
                      src={getImageUrl(primaryImage.storage_path)}
                      alt={shot?.title ?? ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      {shot?.slug ? (
                        <Link
                          to={`/shots/${shot.slug}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {shot.title}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {block.block_type.charAt(0).toUpperCase() + block.block_type.slice(1)}
                        </span>
                      )}
                      {variation && shot?.variations && shot.variations.length > 1 && (
                        <span className="text-xs text-accent ml-2">{variation.title}</span>
                      )}
                      <span className="text-xs text-on-surface-secondary ml-2 capitalize">
                        {block.block_type}
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-secondary">
                      {block.duration_minutes} min
                    </span>
                  </div>

                  {shot && !isEditing && (
                    <div className="flex gap-3 mt-1 text-xs">
                      <span>{block.attempts ?? 0} attempts</span>
                      <span className="text-success">{block.successes ?? 0} hits</span>
                      {(block.attempts ?? 0) > 0 && (
                        <span>
                          {Math.round(
                            ((block.successes ?? 0) / (block.attempts ?? 1)) * 100
                          )}
                          %
                        </span>
                      )}
                    </div>
                  )}

                  {block.notes && !isEditing && (
                    <p className="text-xs text-on-surface-secondary italic mt-1">
                      {block.notes}
                    </p>
                  )}

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-on-surface-secondary">Attempts</label>
                          <input
                            type="number"
                            value={editForm.attempts}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                attempts: Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border bg-surface text-on-surface text-sm"
                            min={0}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-secondary">Hits</label>
                          <input
                            type="number"
                            value={editForm.successes}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                successes: Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-full px-2 py-1 rounded border border-border bg-surface text-on-surface text-sm"
                            min={0}
                          />
                        </div>
                      </div>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, notes: e.target.value }))
                        }
                        placeholder="Notes..."
                        className="w-full px-2 py-1 rounded border border-border bg-surface text-on-surface text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="px-3 py-1 text-xs bg-accent text-white rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBlock(null)}
                          className="px-3 py-1 text-xs bg-surface-secondary border border-border rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit button */}
                  {shot && !isEditing && (
                    <button
                      onClick={() => startEdit(block)}
                      className="text-xs text-accent mt-1"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Session notes */}
      <div>
        <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">Session Notes</h2>
        <textarea
          value={sessionNotes ?? ''}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
          rows={3}
          placeholder="How did the session go?"
        />
        <button
          onClick={saveSessionNotes}
          disabled={savingNotes}
          className="mt-2 px-4 py-1.5 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
        >
          {savingNotes ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}
