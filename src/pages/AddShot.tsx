import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { ImageUpload } from '../components/ImageUpload'
import { upsertMyShotStatus } from '../hooks/useShots'

export function AddShot() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [setupText, setSetupText] = useState('')
  const [frequency, setFrequency] = useState<1 | 2 | 3>(2)
  const [status, setStatus] = useState<'active' | 'pending'>('pending')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)
    const slug = slugify(title)

    // Insert shot
    const { data: shot, error: shotErr } = await supabase
      .from('shots')
      .insert({
        slug,
        title: title.trim(),
        description: description.trim() || null,
        setup_text: setupText.trim() || null,
        frequency,
        status,
      })
      .select()
      .single()

    if (shotErr) {
      setError(shotErr.message)
      setSaving(false)
      return
    }

    // Upload image if provided
    let imageId: string | null = null
    if (imageFile && shot) {
      const storagePath = `${slug}/${imageFile.name}`
      const { error: uploadErr } = await supabase.storage
        .from('shot-images')
        .upload(storagePath, imageFile, { upsert: true })

      if (!uploadErr) {
        const { data: imgRow } = await supabase.from('shot_images').insert({
          shot_id: shot.id,
          file_name: imageFile.name,
          storage_path: storagePath,
          side: 'center',
          is_primary: true,
          sort_order: 0,
        }).select('id').single()
        imageId = imgRow?.id ?? null
      }
    }

    // Create a default variation
    if (shot) {
      await supabase.from('shot_variations').insert({
        shot_id: shot.id,
        title: 'Default',
        image_id: imageId,
        is_default: true,
        sort_order: 0,
      })

      const { error: statusErr } = await upsertMyShotStatus(shot.id, status)
      if (statusErr) {
        console.error('Failed to persist user shot status:', statusErr)
      }
    }

    setSaving(false)
    navigate(`/shots/${slug}`)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Add Shot</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
            placeholder="e.g. long-long-soft"
          />
        </div>

        <ImageUpload
          onFileSelect={(f) => setImageFile(f)}
          currentFile={imageFile}
        />

        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
            rows={3}
            placeholder="What is this shot?"
          />
        </div>

        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Setup Text
          </label>
          <textarea
            value={setupText}
            onChange={(e) => setSetupText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm resize-none"
            rows={3}
            placeholder="Table setup instructions"
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
                onClick={() => setFrequency(f)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  frequency === f
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
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                  status === s
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

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Shot'}
        </button>
      </form>
    </div>
  )
}
