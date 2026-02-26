import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useShots } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { getSessionCount } from '../hooks/useSessions'
import { prioritizeShots, isDueForSession, spacedPeriod } from '../lib/scoring'
import { FREQUENCY_LABELS } from '../types'

export function Dashboard() {
  const { shots, loading: shotsLoading } = useShots()
  const { assessments, loading: assessLoading } = useAssessments()
  const [sessionNumber, setSessionNumber] = useState<number | null>(null)
  const loading = shotsLoading || assessLoading

  useEffect(() => {
    getSessionCount().then((count) => setSessionNumber(count + 1))
  }, [])

  const activeShots = shots.filter((s) => s.status === 'active')
  const prioritized = prioritizeShots(shots, assessments)
  const assessedCount = new Set(assessments.map((a) => a.shot_id)).size

  // Score distribution
  const scoreDistribution = { 1: 0, 2: 0, 3: 0 }
  for (const { aggregateScore } of prioritized) {
    scoreDistribution[aggregateScore as 1 | 2 | 3]++
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {loading ? (
        <p className="text-on-surface-secondary text-sm">Loading...</p>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Active Shots" value={activeShots.length} />
            <StatCard label="Assessed" value={assessedCount} />
            <StatCard
              label="Next Session"
              value={sessionNumber !== null ? `#${sessionNumber}` : '...'}
            />
          </div>

          {/* Score distribution bar */}
          {prioritized.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">
                Score Distribution
              </h2>
              <div className="flex rounded-lg overflow-hidden h-6 text-xs font-medium">
                {scoreDistribution[1] > 0 && (
                  <div
                    className="bg-danger/80 text-white flex items-center justify-center"
                    style={{ width: `${(scoreDistribution[1] / prioritized.length) * 100}%` }}
                  >
                    {scoreDistribution[1]}
                  </div>
                )}
                {scoreDistribution[2] > 0 && (
                  <div
                    className="bg-warning/80 text-white flex items-center justify-center"
                    style={{ width: `${(scoreDistribution[2] / prioritized.length) * 100}%` }}
                  >
                    {scoreDistribution[2]}
                  </div>
                )}
                {scoreDistribution[3] > 0 && (
                  <div
                    className="bg-success/80 text-white flex items-center justify-center"
                    style={{ width: `${(scoreDistribution[3] / prioritized.length) * 100}%` }}
                  >
                    {scoreDistribution[3]}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-secondary mt-1">
                <span>Score 1 (needs work)</span>
                <span>Score 2 (developing)</span>
                <span>Score 3 (solid)</span>
              </div>
            </div>
          )}

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

          {/* Shot performance table */}
          {prioritized.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-on-surface-secondary mb-2">
                Shot Performance
              </h2>
              <div className="border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 bg-surface-secondary text-xs font-semibold text-on-surface-secondary border-b border-border">
                  <span>Shot</span>
                  <span className="w-12 text-center">Score</span>
                  <span className="w-12 text-center">Freq</span>
                  <span className="w-20 text-center">Next Due</span>
                </div>

                {/* Rows */}
                {prioritized.map(({ shot, aggregateScore }) => {
                  const period = spacedPeriod(aggregateScore)
                  const nextDue = sessionNumber !== null
                    ? (() => {
                        let s = sessionNumber
                        while (s < sessionNumber + period + 1) {
                          if (isDueForSession(aggregateScore, s)) return s
                          s++
                        }
                        return s
                      })()
                    : null
                  const isDueNow = sessionNumber !== null && isDueForSession(aggregateScore, sessionNumber)

                  return (
                    <Link
                      key={shot.id}
                      to={`/shots/${shot.slug}`}
                      className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors ${
                        isDueNow ? 'bg-accent/5' : ''
                      }`}
                    >
                      <span className="truncate font-medium">{shot.title}</span>
                      <span className="w-12 text-center">
                        <span
                          className={`inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 text-center ${
                            aggregateScore === 1
                              ? 'bg-danger/15 text-danger'
                              : aggregateScore === 2
                                ? 'bg-warning/15 text-warning'
                                : 'bg-success/15 text-success'
                          }`}
                        >
                          {aggregateScore}
                        </span>
                      </span>
                      <span className="w-12 text-center text-xs text-on-surface-secondary leading-6">
                        {FREQUENCY_LABELS[shot.frequency]}
                      </span>
                      <span
                        className={`w-20 text-center text-xs leading-6 ${
                          isDueNow ? 'text-accent font-semibold' : 'text-on-surface-secondary'
                        }`}
                      >
                        {isDueNow ? 'Now' : nextDue !== null ? `Sess #${nextDue}` : '—'}
                      </span>
                    </Link>
                  )
                })}
              </div>

              <p className="text-[10px] text-on-surface-secondary mt-2">
                Sorted by priority (lowest score first). Rows highlighted in blue are due in the next session.
              </p>
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
