import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useShot } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { useShotSessionHistory } from '../hooks/useSessions'
import { supabase, getImageUrl } from '../lib/supabase'
import { FREQUENCY_LABELS, COMFORT_LABELS } from '../types'
import { ImageUpload } from '../components/ImageUpload'

interface EditVariation {
  id?: string // undefined = new
  title: string
  setup_note: string
  image_id: string | null
  image_storage_path: string | null // for thumbnail display
  is_default: boolean
  sort_order: number
  newImageFile?: File | null // pending upload
}

export function ShotDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { shot, loading, error, refetch } = useShot(slug)
  const { assessments } = useAssessments(shot?.id)
  const { entries: sessionHistory } = useShotSessionHistory(shot?.id)
  const [variationIndex, setVariationIndex] = useState(0)

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSetupText, setEditSetupText] = useState('')
  const [editFrequency, setEditFrequency] = useState<1 | 2 | 3>(2)
  const [editStatus, setEditStatus] = useState<'active' | 'pending'>('active')
  const [editVariations, setEditVariations] = useState<EditVariation[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadingForIndex, setUploadingForIndex] = useState<number | null>(null)

  if (loading) return <div className="p-4 text-on-surface-secondary">Loading...</div>
  if (error || !shot) return <div className="p-4 text-danger">Shot not found</div>

  const variations = shot.variations ?? []
  const currentVariation = variations[variationIndex]
  const currentImage = currentVariation?.image ?? null

  function startEditing() {
    setEditTitle(shot!.title)
    setEditDescription(shot!.description ?? '')
    setEditSetupText(shot!.setup_text ?? '')
    setEditFrequency(shot!.frequency)
    setEditStatus(shot!.status)
    setEditVariations(
      (shot!.variations ?? []).map((v) => ({
        id: v.id,
        title: v.title,
        setup_note: v.setup_note ?? '',
        image_id: v.image_id,
        image_storage_path: v.image?.storage_path ?? null,
        is_default: v.is_default,
        sort_order: v.sort_order,
      }))
    )
    setSaveError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError(null)
    setUploadingForIndex(null)
  }

  function updateEditVariation(index: number, updates: Partial<EditVariation>) {
    setEditVariations((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...updates } : v))
    )
  }

  function handleSetDefault(index: number) {
    setEditVariations((prev) =>
      prev.map((v, i) => ({ ...v, is_default: i === index }))
    )
  }

  function handleAddVariation() {
    setEditVariations((prev) => [
      ...prev,
      {
        title: 'New variation',
        setup_note: '',
        image_id: null,
        image_storage_path: null,
        is_default: prev.length === 0,
        sort_order: prev.length,
      },
    ])
  }

  function handleRemoveVariation(index: number) {
    setEditVariations((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      // If we removed the default, make first one default
      if (updated.length > 0 && !updated.some((v) => v.is_default)) {
        updated[0].is_default = true
      }
      return updated.map((v, i) => ({ ...v, sort_order: i }))
    })
  }

  async function handleSave() {
    if (!shot) return
    if (!editTitle.trim()) {
      setSaveError('Title is required')
      return
    }

    setSaving(true)
    setSaveError(null)

    // Update shot fields
    const { error: updateErr } = await supabase
      .from('shots')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        setup_text: editSetupText.trim() || null,
        frequency: editFrequency,
        status: editStatus,
      })
      .eq('id', shot.id)

    if (updateErr) {
      setSaveError(updateErr.message)
      setSaving(false)
      return
    }

    // Delete removed variations (those with IDs not in editVariations)
    const existingIds = (shot.variations ?? []).map((v) => v.id)
    const keptIds = editVariations.filter((v) => v.id).map((v) => v.id!)
    const deletedIds = existingIds.filter((id) => !keptIds.includes(id))
    if (deletedIds.length > 0) {
      await supabase.from('shot_variations').delete().in('id', deletedIds)
    }

    // Upsert variations
    for (const v of editVariations) {
      // Upload new image if attached
      let imageId = v.image_id
      if (v.newImageFile) {
        const storagePath = `${shot.slug}/${v.newImageFile.name}`
        const { error: uploadErr } = await supabase.storage
          .from('shot-images')
          .upload(storagePath, v.newImageFile, { upsert: true })

        if (!uploadErr) {
          const { data: imgRow } = await supabase
            .from('shot_images')
            .insert({
              shot_id: shot.id,
              file_name: v.newImageFile.name,
              storage_path: storagePath,
              side: 'center',
              is_primary: false,
              sort_order: 0,
            })
            .select('id')
            .single()
          imageId = imgRow?.id ?? null
        }
      }

      if (v.id) {
        // Update existing
        await supabase
          .from('shot_variations')
          .update({
            title: v.title.trim(),
            setup_note: v.setup_note.trim() || null,
            image_id: imageId,
            is_default: v.is_default,
            sort_order: v.sort_order,
          })
          .eq('id', v.id)
      } else {
        // Insert new
        await supabase.from('shot_variations').insert({
          shot_id: shot.id,
          title: v.title.trim(),
          setup_note: v.setup_note.trim() || null,
          image_id: imageId,
          is_default: v.is_default,
          sort_order: v.sort_order,
        })
      }
    }

    setSaving(false)
    setEditing(false)
    setUploadingForIndex(null)
    refetch()
  }

  return (
    <div className="pb-4">
      {/* Variation carousel */}
      <div className="relative aspect-[4/3] sm:aspect-[16/9] max-h-[50vh] bg-black">
        {currentImage ? (
          <img
            src={getImageUrl(currentImage.storage_path)}
            alt={shot.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            {currentVariation ? currentVariation.title : 'No variations'}
          </div>
        )}

        {variations.length > 1 && (
          <>
            <button
              onClick={() => setVariationIndex((i) => (i - 1 + variations.length) % variations.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              &larr;
            </button>
            <button
              onClick={() => setVariationIndex((i) => (i + 1) % variations.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              &rarr;
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {variations.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === variationIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Variation title + default badge overlay */}
        {currentVariation && (
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
            {currentVariation.is_default && variations.length > 1 && (
              <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">
                Default
              </span>
            )}
            {variations.length > 1 && (
              <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full ml-auto">
                {currentVariation.title}
              </span>
            )}
          </div>
        )}

        {/* Setup note overlay */}
        {currentVariation?.setup_note && (
          <div className="absolute bottom-8 left-2 right-2">
            <p className="text-xs bg-black/60 text-white px-2 py-1 rounded-lg line-clamp-2">
              {currentVariation.setup_note}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/shots" className="text-accent text-sm">&larr; Shots</Link>
          </div>

          {!editing ? (
            <>
              <div className="flex items-start justify-between">
                <h1 className="text-xl font-bold">{shot.title}</h1>
                <button
                  onClick={startEditing}
                  className="text-xs text-accent px-3 py-1 rounded-lg border border-accent/30 hover:bg-accent/5 transition-colors shrink-0 ml-2"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    shot.status === 'active'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {shot.status}
                </span>
                <span className="text-xs text-on-surface-secondary">
                  Frequency: {FREQUENCY_LABELS[shot.frequency]}
                </span>
                {variations.length > 1 && (
                  <span className="text-xs text-on-surface-secondary">
                    {variations.length} variations
                  </span>
                )}
              </div>
            </>
          ) : (
            /* Edit form */
            <div className="space-y-3">
              <div>
                <label className="text-sm text-on-surface-secondary block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-on-surface-secondary block mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm text-on-surface-secondary block mb-1">
                  Setup Text
                </label>
                <textarea
                  value={editSetupText}
                  onChange={(e) => setEditSetupText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm text-on-surface-secondary block mb-1">
                  Frequency
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setEditFrequency(f)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                        editFrequency === f
                          ? 'border-accent bg-accent/10 text-accent font-medium'
                          : 'border-border text-on-surface-secondary'
                      }`}
                    >
                      {f === 1 ? 'Low' : f === 2 ? 'Medium' : 'High'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-on-surface-secondary block mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['pending', 'active'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                        editStatus === s
                          ? s === 'active'
                            ? 'border-success bg-success/10 text-success font-medium'
                            : 'border-warning bg-warning/10 text-warning font-medium'
                          : 'border-border text-on-surface-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variation management */}
              <div>
                <label className="text-sm text-on-surface-secondary block mb-2">
                  Variations
                </label>
                <div className="space-y-3">
                  {editVariations.map((v, i) => (
                    <div
                      key={v.id ?? `new-${i}`}
                      className={`p-3 rounded-lg border ${
                        v.is_default ? 'border-accent bg-accent/5' : 'border-border bg-surface-secondary'
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div
                          className="w-16 h-16 rounded-lg bg-black overflow-hidden shrink-0 cursor-pointer"
                          onClick={() => setUploadingForIndex(uploadingForIndex === i ? null : i)}
                        >
                          {v.newImageFile ? (
                            <img
                              src={URL.createObjectURL(v.newImageFile)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : v.image_storage_path ? (
                            <img
                              src={getImageUrl(v.image_storage_path)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px]">
                              + img
                            </div>
                          )}
                        </div>

                        {/* Fields */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={v.title}
                            onChange={(e) => updateEditVariation(i, { title: e.target.value })}
                            placeholder="Variation name"
                            className="w-full px-2 py-1 rounded border border-border bg-surface text-on-surface text-sm"
                          />
                          <input
                            type="text"
                            value={v.setup_note}
                            onChange={(e) => updateEditVariation(i, { setup_note: e.target.value })}
                            placeholder="Setup note (optional)"
                            className="w-full px-2 py-1 rounded border border-border bg-surface text-on-surface text-xs"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        {!v.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(i)}
                            className="text-[10px] px-2 py-0.5 rounded border border-accent/30 text-accent hover:bg-accent/5 transition-colors"
                          >
                            Set Default
                          </button>
                        )}
                        {v.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-white">
                            Default
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveVariation(i)}
                          disabled={editVariations.length <= 1}
                          className="text-[10px] px-2 py-0.5 rounded border border-danger/30 text-danger hover:bg-danger/5 transition-colors disabled:opacity-30 ml-auto"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Image upload for this variation */}
                      {uploadingForIndex === i && (
                        <div className="mt-2">
                          <ImageUpload
                            onFileSelect={(f) => {
                              updateEditVariation(i, { newImageFile: f })
                              setUploadingForIndex(null)
                            }}
                            currentFile={v.newImageFile ?? null}
                            label="Choose Image"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddVariation}
                  className="w-full mt-2 py-2 text-sm rounded-lg border border-dashed border-accent/40 text-accent hover:bg-accent/5 transition-colors"
                >
                  + Add Variation
                </button>
              </div>

              {saveError && <p className="text-danger text-sm">{saveError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 bg-surface-secondary border border-border rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Description (view mode) */}
        {!editing && shot.description && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-1">Description</h2>
            <p className="text-sm">{shot.description}</p>
          </div>
        )}

        {/* Setup (view mode) */}
        {!editing && shot.setup_text && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-1">Setup</h2>
            <p className="text-sm whitespace-pre-wrap">{shot.setup_text}</p>
          </div>
        )}

        {/* Tags */}
        {!editing && shot.tags && shot.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {shot.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Assessment history */}
        {!editing && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">
              Assessments ({assessments.length})
            </h2>
            {assessments.length === 0 ? (
              <p className="text-sm text-on-surface-secondary">No assessments yet.</p>
            ) : (
              <div className="space-y-2">
                {assessments.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg border border-border bg-surface-secondary text-sm"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">
                        Score: {a.aggregate_score}/3
                      </span>
                      <span className="text-xs text-on-surface-secondary">
                        {new Date(a.assessed_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-on-surface-secondary">
                      <span>Comfort: {COMFORT_LABELS[a.comfort_level]}</span>
                      <span>Viz: {COMFORT_LABELS[a.visualization]}</span>
                      <span>Stroke: {a.beautiful_stroke ? 'Yes' : 'No'}</span>
                      <span>Alignment: {a.alignment_correct ? 'Yes' : 'No'}</span>
                      <span>Result: {a.result === 2 ? 'Good' : 'Not good'}</span>
                    </div>
                    {a.notes && (
                      <p className="mt-1 text-xs text-on-surface-secondary italic">
                        {a.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Session history */}
        {!editing && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">
              Session History ({sessionHistory.length} blocks)
            </h2>
            {sessionHistory.length === 0 ? (
              <p className="text-sm text-on-surface-secondary">
                Not practiced in any sessions yet.
              </p>
            ) : (
              <SessionHistoryTable entries={sessionHistory} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Grouped session history: aggregates blocks per session date */
function SessionHistoryTable({ entries }: { entries: import('../hooks/useSessions').ShotSessionEntry[] }) {
  // Group entries by session_id
  const grouped = new Map<string, typeof entries>()
  for (const e of entries) {
    const list = grouped.get(e.session_id) ?? []
    list.push(e)
    grouped.set(e.session_id, list)
  }

  // Convert to sorted array (newest first — entries are already sorted by date desc)
  const sessions = Array.from(grouped.entries()).map(([sessionId, blocks]) => {
    const totalAttempts = blocks.reduce((s, b) => s + b.attempts, 0)
    const totalSuccesses = blocks.reduce((s, b) => s + b.successes, 0)
    const totalMinutes = blocks.reduce((s, b) => s + b.duration_minutes, 0)
    const rate = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : null
    return {
      sessionId,
      date: blocks[0].session_date,
      blocks,
      totalAttempts,
      totalSuccesses,
      totalMinutes,
      rate,
    }
  })

  // Overall stats
  const allAttempts = sessions.reduce((s, r) => s + r.totalAttempts, 0)
  const allSuccesses = sessions.reduce((s, r) => s + r.totalSuccesses, 0)
  const overallRate = allAttempts > 0 ? Math.round((allSuccesses / allAttempts) * 100) : null

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg border border-border bg-surface-secondary text-center">
            <div className="text-lg font-bold">{sessions.length}</div>
            <div className="text-[10px] text-on-surface-secondary">Sessions</div>
          </div>
          <div className="p-2 rounded-lg border border-border bg-surface-secondary text-center">
            <div className="text-lg font-bold">{allAttempts}</div>
            <div className="text-[10px] text-on-surface-secondary">Attempts</div>
          </div>
          <div className="p-2 rounded-lg border border-border bg-surface-secondary text-center">
            <div className="text-lg font-bold">
              {overallRate !== null ? `${overallRate}%` : '—'}
            </div>
            <div className="text-[10px] text-on-surface-secondary">Hit Rate</div>
          </div>
        </div>
      )}

      {/* Per-session rows */}
      {sessions.map((s) => (
        <Link
          key={s.sessionId}
          to={`/session/${s.sessionId}/review`}
          className="block p-3 rounded-lg border border-border bg-surface-secondary text-sm hover:border-accent transition-colors"
        >
          <div className="flex justify-between items-center">
            <span className="font-medium">
              {new Date(s.date).toLocaleDateString()}
            </span>
            <span className="text-xs text-on-surface-secondary">
              {s.totalMinutes} min
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs">
            <span>{s.totalAttempts} attempts</span>
            <span className="text-success">{s.totalSuccesses} hits</span>
            <span className="font-medium">
              {s.rate !== null ? `${s.rate}%` : '—'}
            </span>
          </div>
          {s.blocks.some((b) => b.shot_variation || b.shot_image) && (
            <div className="flex gap-1.5 mt-1.5 items-center">
              {s.blocks
                .filter((b) => b.shot_variation || b.shot_image)
                .map((b, i) => {
                  const img = b.shot_variation?.image ?? b.shot_image
                  const label = b.shot_variation?.title
                  return (
                    <div key={i} className="flex items-center gap-1">
                      {img && (
                        <div className="w-8 h-8 rounded overflow-hidden bg-black shrink-0">
                          <img
                            src={getImageUrl(img.storage_path)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {label && (
                        <span className="text-[10px] text-on-surface-secondary">{label}</span>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}
