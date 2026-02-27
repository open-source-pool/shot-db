import { useState } from 'react'
import { useShots } from '../hooks/useShots'
import { createAssessment } from '../hooks/useAssessments'
import { getImageUrl } from '../lib/supabase'
import { computeAggregate } from '../lib/scoring'
import { COMFORT_LABELS } from '../types'
import type { Shot } from '../types'

interface FormValues {
  comfort_level: 1 | 2 | 3 | 4
  visualization: 1 | 2 | 3 | 4
  beautiful_stroke: boolean
  alignment_correct: boolean
  result: 1 | 2
  notes: string
}

const defaultValues: FormValues = {
  comfort_level: 1,
  visualization: 1,
  beautiful_stroke: false,
  alignment_correct: false,
  result: 1,
  notes: '',
}

export function Assessment() {
  const { shots, loading } = useShots()
  const activeShots = shots.filter((s) => s.status === 'active')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [form, setForm] = useState<FormValues>(defaultValues)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  if (loading) return <div className="p-4 text-on-surface-secondary">Loading shots...</div>
  if (activeShots.length === 0) return <div className="p-4">No active shots to assess.</div>

  const allDone = completed.size === activeShots.length
  const shot: Shot = activeShots[currentIndex]
  const primaryImage = shot.images?.find((img) => img.is_primary) ?? shot.images?.[0]
  const preview = computeAggregate(form)

  async function handleSubmit() {
    setSaving(true)
    await createAssessment({
      shot_id: shot.id,
      comfort_level: form.comfort_level,
      visualization: form.visualization,
      beautiful_stroke: form.beautiful_stroke,
      alignment_correct: form.alignment_correct,
      result: form.result,
      notes: form.notes || undefined,
    })
    setCompleted((prev) => new Set(prev).add(shot.id))
    setForm(defaultValues)
    setSaving(false)

    // Move to next unassessed shot
    if (currentIndex < activeShots.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  if (allDone) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl font-bold mb-2">Assessment Complete</h1>
        <p className="text-on-surface-secondary mb-4">
          All {activeShots.length} shots assessed.
        </p>
        <button
          onClick={() => {
            setCompleted(new Set())
            setCurrentIndex(0)
          }}
          className="px-4 py-2 bg-accent text-white rounded-lg"
        >
          Start Over
        </button>
      </div>
    )
  }

  return (
    <div className="pb-4">
      {/* Progress */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Assess</h1>
        <span className="text-sm text-on-surface-secondary">
          {currentIndex + 1} / {activeShots.length}
          {currentIndex > completed.size && (
            <span className="text-warning ml-2">
              ({currentIndex - completed.size} skipped)
            </span>
          )}
        </span>
      </div>
      <div className="mx-4 h-1 bg-surface-secondary rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${((currentIndex + 1) / activeShots.length) * 100}%` }}
        />
      </div>

      {/* Shot image */}
      <div key={shot.id} className="aspect-[4/3] bg-black mx-4 rounded-xl overflow-hidden mb-4 animate-fade-in">
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

      <div className="px-4 space-y-4">
        <h2 className="font-semibold">{shot.title}</h2>

        {/* Comfort level */}
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface-secondary mb-1">
            Comfort Level
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4] as const).map((v) => (
              <button
                key={v}
                onClick={() => setForm((f) => ({ ...f, comfort_level: v }))}
                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-150 active:scale-95 ${
                  form.comfort_level === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-on-surface-secondary'
                }`}
              >
                {COMFORT_LABELS[v]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Visualization */}
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface-secondary mb-1">
            Visualization Fidelity
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([1, 2, 3, 4] as const).map((v) => (
              <button
                key={v}
                onClick={() => setForm((f) => ({ ...f, visualization: v }))}
                className={`px-3 py-2 text-xs rounded-lg border transition-all duration-150 active:scale-95 ${
                  form.visualization === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-on-surface-secondary'
                }`}
              >
                {COMFORT_LABELS[v]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Beautiful stroke */}
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface-secondary mb-1">
            Beautiful Stroke Applied?
          </legend>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setForm((f) => ({ ...f, beautiful_stroke: v }))}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all duration-150 active:scale-95 ${
                  form.beautiful_stroke === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-on-surface-secondary'
                }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Alignment */}
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface-secondary mb-1">
            Alignment Correct?
          </legend>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setForm((f) => ({ ...f, alignment_correct: v }))}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all duration-150 active:scale-95 ${
                  form.alignment_correct === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-on-surface-secondary'
                }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Result */}
        <fieldset>
          <legend className="text-sm font-semibold text-on-surface-secondary mb-1">
            Result
          </legend>
          <div className="flex gap-2">
            {([1, 2] as const).map((v) => (
              <button
                key={v}
                onClick={() => setForm((f) => ({ ...f, result: v }))}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all duration-150 active:scale-95 ${
                  form.result === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-on-surface-secondary'
                }`}
              >
                {v === 2 ? 'Good attempt' : 'Not good'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold text-on-surface-secondary mb-1 block">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
            rows={2}
            placeholder="Optional notes..."
          />
        </div>

        {/* Preview score & submit */}
        <div className="flex items-center justify-between">
          <span className="text-sm">
            Aggregate score:{' '}
            <span className="font-bold text-accent">{preview}/3</span>
          </span>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Next'}
          </button>
        </div>

        {/* Skip nav */}
        <div className="flex justify-between text-sm pt-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="text-on-surface-secondary disabled:opacity-30"
          >
            &larr; Previous
          </button>
          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(activeShots.length - 1, i + 1))
            }
            disabled={currentIndex === activeShots.length - 1}
            className="text-on-surface-secondary disabled:opacity-30"
          >
            Skip &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
