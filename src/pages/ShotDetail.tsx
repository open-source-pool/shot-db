import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useShot } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { getImageUrl } from '../lib/supabase'
import { FREQUENCY_LABELS, COMFORT_LABELS } from '../types'

export function ShotDetail() {
  const { slug } = useParams<{ slug: string }>()
  const { shot, loading, error } = useShot(slug)
  const { assessments } = useAssessments(shot?.id)
  const [imageIndex, setImageIndex] = useState(0)

  if (loading) return <div className="p-4 text-on-surface-secondary">Loading...</div>
  if (error || !shot) return <div className="p-4 text-danger">Shot not found</div>

  const images = shot.images ?? []
  const currentImage = images[imageIndex]

  return (
    <div className="pb-4">
      {/* Image carousel */}
      <div className="relative aspect-[4/3] bg-black">
        {currentImage ? (
          <img
            src={getImageUrl(currentImage.storage_path)}
            alt={shot.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No image
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              &larr;
            </button>
            <button
              onClick={() => setImageIndex((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
            >
              &rarr;
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === imageIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/shots" className="text-accent text-sm">&larr; Shots</Link>
          </div>
          <h1 className="text-xl font-bold">{shot.title}</h1>
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
          </div>
        </div>

        {/* Description */}
        {shot.description && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-1">Description</h2>
            <p className="text-sm">{shot.description}</p>
          </div>
        )}

        {/* Setup */}
        {shot.setup_text && (
          <div>
            <h2 className="text-sm font-semibold text-on-surface-secondary mb-1">Setup</h2>
            <p className="text-sm whitespace-pre-wrap">{shot.setup_text}</p>
          </div>
        )}

        {/* Tags */}
        {shot.tags && shot.tags.length > 0 && (
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
      </div>
    </div>
  )
}
