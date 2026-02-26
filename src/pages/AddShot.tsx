import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

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
    if (imageFile && shot) {
      const storagePath = `${slug}/${imageFile.name}`
      const { error: uploadErr } = await supabase.storage
        .from('shot-images')
        .upload(storagePath, imageFile, { upsert: true })

      if (!uploadErr) {
        await supabase.from('shot_images').insert({
          shot_id: shot.id,
          file_name: imageFile.name,
          storage_path: storagePath,
          side: 'center',
          is_primary: true,
          sort_order: 0,
        })
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-on-surface-secondary block mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
            >
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-on-surface-secondary block mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'pending')}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-on-surface-secondary block mb-1">
            Shot Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-on-surface-secondary"
          />
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Shot'}
        </button>
      </form>
    </div>
  )
}
