import { useState } from 'react'
import { Link } from 'react-router'
import { useShots } from '../hooks/useShots'
import { ShotCard } from '../components/ShotCard'

type StatusFilter = 'all' | 'active' | 'pending'
type FreqFilter = 0 | 1 | 2 | 3

export function Gallery() {
  const { shots, loading, error, setShotStatus, setShotStatusBulk, updatingStatusIds } = useShots()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [freq, setFreq] = useState<FreqFilter>(0)
  const [search, setSearch] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = shots.filter((s) => {
    if (status !== 'all' && s.status !== status) return false
    if (freq !== 0 && s.frequency !== freq) return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  async function handleSetStatus(shotId: string, nextStatus: 'active' | 'pending') {
    setActionError(null)
    const statusError = await setShotStatus(shotId, nextStatus)
    if (statusError) setActionError(statusError)
  }

  function toggleSelected(shotId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(shotId)
      else next.delete(shotId)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function selectVisible() {
    setSelectedIds(new Set(filtered.map((shot) => shot.id)))
  }

  async function handleBulkStatus(statusValue: 'active' | 'pending') {
    setActionError(null)
    const ids = [...selectedIds]
    const statusError = await setShotStatusBulk(ids, statusValue)
    if (statusError) {
      setActionError(statusError)
      return
    }
    clearSelection()
  }

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

      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => {
            setBulkMode((prev) => !prev)
            setSelectedIds(new Set())
            setActionError(null)
          }}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            bulkMode
              ? 'border-accent bg-accent text-white'
              : 'border-border text-on-surface-secondary'
          }`}
        >
          {bulkMode ? 'Exit Bulk Select' : 'Bulk Select'}
        </button>
        {bulkMode && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-secondary">
              Selected: {selectedIds.size}
            </span>
            <button
              type="button"
              onClick={selectVisible}
              className="px-2 py-1 text-xs rounded-lg border border-border text-on-surface-secondary"
            >
              Select Visible
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2 py-1 text-xs rounded-lg border border-border text-on-surface-secondary"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {bulkMode && (
        <div className="mb-3 p-2 rounded-lg border border-border bg-surface-secondary flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleBulkStatus('active')}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-xs rounded-lg border border-success text-success disabled:opacity-50"
          >
            Mark Active
          </button>
          <button
            type="button"
            onClick={() => void handleBulkStatus('pending')}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-xs rounded-lg border border-warning text-warning disabled:opacity-50"
          >
            Mark Pending
          </button>
        </div>
      )}

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

      {actionError && (
        <p className="text-danger text-sm mb-3">{actionError}</p>
      )}

      {loading ? (
        <p className="text-on-surface-secondary text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-on-surface-secondary text-sm">No shots found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              onSetStatus={(shotId, nextStatus) => void handleSetStatus(shotId, nextStatus)}
              statusUpdating={updatingStatusIds.includes(shot.id)}
              bulkMode={bulkMode}
              selected={selectedIds.has(shot.id)}
              onSelectedChange={toggleSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}
