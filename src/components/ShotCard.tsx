import { Link } from 'react-router'
import type { Shot } from '../types'
import { FREQUENCY_LABELS } from '../types'
import { getImageUrl } from '../lib/supabase'
import { getShotDisplayImage } from '../lib/variations'

export function ShotCard({ shot }: { shot: Shot }) {
  const primaryImage = getShotDisplayImage(shot)

  return (
    <Link
      to={`/shots/${shot.slug}`}
      className="block rounded-xl overflow-hidden bg-surface-secondary border border-border hover:border-accent transition-colors"
    >
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
      </div>
    </Link>
  )
}
