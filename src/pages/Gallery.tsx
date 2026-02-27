import { useState } from 'react'
import { Link } from 'react-router'
import { useShots } from '../hooks/useShots'
import { ShotCard } from '../components/ShotCard'

type StatusFilter = 'all' | 'active' | 'pending'
type FreqFilter = 0 | 1 | 2 | 3

export function Gallery() {
  const { shots, loading, error } = useShots()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [freq, setFreq] = useState<FreqFilter>(0)
  const [search, setSearch] = useState('')

  const filtered = shots.filter((s) => {
    if (status !== 'all' && s.status !== status) return false
    if (freq !== 0 && s.frequency !== freq) return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  if (error) {
    return (
      <div className="p-4">
        <p className="text-danger">Failed to load shots: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Shots</h1>
        <Link
          to="/add-shot"
          className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors"
        >
          + Add
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search shots..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface placeholder:text-on-surface-secondary text-sm"
      />

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all', 'active', 'pending'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              status === s
                ? 'bg-accent text-white'
                : 'bg-surface-secondary text-on-surface-secondary'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="border-l border-border mx-1" />
        {([0, 3, 2, 1] as FreqFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFreq(f)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              freq === f
                ? 'bg-accent text-white'
                : 'bg-surface-secondary text-on-surface-secondary'
            }`}
          >
            {f === 0 ? 'Any freq' : f === 3 ? 'High' : f === 2 ? 'Medium' : 'Low'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-on-surface-secondary text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-on-surface-secondary text-sm">No shots found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((shot) => (
            <ShotCard key={shot.id} shot={shot} />
          ))}
        </div>
      )}
    </div>
  )
}
