import { Link } from 'react-router'
import { useShots } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { prioritizeShots } from '../lib/scoring'
import { getImageUrl } from '../lib/supabase'

export function Dashboard() {
  const { shots, loading: shotsLoading } = useShots()
  const { assessments, loading: assessLoading } = useAssessments()
  const loading = shotsLoading || assessLoading

  const activeShots = shots.filter((s) => s.status === 'active')
  const prioritized = prioritizeShots(shots, assessments)
  const assessedCount = new Set(assessments.map((a) => a.shot_id)).size
  const avgScore =
    assessments.length > 0
      ? (
          assessments.reduce((sum, a) => sum + a.aggregate_score, 0) /
          assessments.length
        ).toFixed(1)
      : '—'

  // Score variance
  const scores = assessments.map((a) => a.aggregate_score)
  const variance =
    scores.length > 1
      ? (() => {
          const mean = scores.reduce((a, b) => a + b, 0) / scores.length
          const sqDiffs = scores.map((s) => (s - mean) ** 2)
          return (sqDiffs.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        })()
      : '—'

  const weakest = prioritized.slice(0, 3)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {loading ? (
        <p className="text-on-surface-secondary text-sm">Loading...</p>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Shots" value={activeShots.length} />
            <StatCard label="Assessed" value={assessedCount} />
            <StatCard label="Avg Score" value={avgScore} />
            <StatCard label="Variance" value={variance} />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/session/new"
              className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center text-accent font-semibold"
            >
              Start Session
            </Link>
            <Link
              to="/assess"
              className="p-4 rounded-xl bg-success/10 border border-success/30 text-center text-success font-semibold"
            >
              Run Assessment
            </Link>
          </div>

          {/* Weakest shots */}
          {weakest.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">
                Priority Shots
              </h2>
              <div className="space-y-2">
                {weakest.map(({ shot, aggregateScore }) => {
                  const img =
                    shot.images?.find((i) => i.is_primary) ?? shot.images?.[0]
                  return (
                    <Link
                      key={shot.id}
                      to={`/shots/${shot.slug}`}
                      className="flex items-center gap-3 p-2 rounded-lg border border-border bg-surface-secondary hover:border-accent transition-colors"
                    >
                      <div className="w-14 h-14 rounded-lg bg-black overflow-hidden shrink-0">
                        {img ? (
                          <img
                            src={getImageUrl(img.storage_path)}
                            alt={shot.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {shot.title}
                        </div>
                        <div className="text-xs text-on-surface-secondary">
                          Score: {aggregateScore}/3
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-surface-secondary text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-on-surface-secondary">{label}</div>
    </div>
  )
}
