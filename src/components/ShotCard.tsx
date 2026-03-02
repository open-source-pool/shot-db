import { Link } from 'react-router'
import type { Shot } from '../types'
import { FREQUENCY_LABELS } from '../types'
import { getImageUrl } from '../lib/supabase'
import { getShotDisplayImage } from '../lib/variations'

interface ShotCardProps {
  shot: Shot
  onSetStatus?: (shotId: string, status: 'active' | 'pending') => void
  statusUpdating?: boolean
  bulkMode?: boolean
  selected?: boolean
  onSelectedChange?: (shotId: string, selected: boolean) => void
}

export function ShotCard({
  shot,
  onSetStatus,
  statusUpdating = false,
  bulkMode = false,
  selected = false,
  onSelectedChange,
}: ShotCardProps) {
  const primaryImage = getShotDisplayImage(shot)

  return (
    <div className="relative rounded-xl overflow-hidden bg-surface-secondary border border-border hover:border-accent transition-colors">
      {bulkMode && (
        <label className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[11px] px-1.5 py-1 rounded bg-surface/90 border border-border text-on-surface-secondary">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectedChange?.(shot.id, e.target.checked)}
            className="rounded border-border"
            aria-label={`Select ${shot.title}`}
          />
        </label>
      )}
      <Link to={`/shots/${shot.slug}`} className="block">
        <div className="aspect-[4/3] sm:aspect-[3/2] bg-surface-secondary overflow-hidden">
          {primaryImage ? (
            <img
              src={getImageUrl(primaryImage.storage_path)}
              alt={shot.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-secondary">
              No image
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-sm sm:text-base text-on-surface truncate">
          {shot.title}
        </h3>

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
            {FREQUENCY_LABELS[shot.frequency]}
          </span>
          {(shot.variations?.length ?? 0) > 1 && (
            <span className="text-xs text-on-surface-secondary">
              {shot.variations!.length} vars
            </span>
          )}
        </div>

        {onSetStatus && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => onSetStatus(shot.id, 'active')}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                shot.status === 'active'
                  ? 'border-success bg-success/10 text-success font-medium'
                  : 'border-border text-on-surface-secondary'
              } disabled:opacity-50`}
            >
              Active
            </button>
            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => onSetStatus(shot.id, 'pending')}
              className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                shot.status === 'pending'
                  ? 'border-warning bg-warning/10 text-warning font-medium'
                  : 'border-border text-on-surface-secondary'
              } disabled:opacity-50`}
            >
              Pending
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
