import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useShots } from '../hooks/useShots'
import { useAssessments } from '../hooks/useAssessments'
import { getSessionCount, useLastPracticed, useShotSuccessRates } from '../hooks/useSessions'
import { prioritizeShots, nextDueSession, sortByRotation } from '../lib/scoring'
import type { ShotWithScore } from '../lib/scoring'
import { getImageUrl } from '../lib/supabase'
import { getShotDisplayImage } from '../lib/variations'
import { FREQUENCY_LABELS } from '../types'
import { Sparkline } from '../components/Sparkline'

export function Dashboard() {
  const { shots, loading: shotsLoading } = useShots()
  const { assessments, loading: assessLoading } = useAssessments()
  const { lastPracticedMap, lastPracticedSessionAgo, loading: lpLoading } = useLastPracticed()
  const { ratesByShot, loading: ratesLoading } = useShotSuccessRates()
  const [sessionNumber, setSessionNumber] = useState<number | null>(null)
  const loading = shotsLoading || assessLoading || lpLoading || ratesLoading

  useEffect(() => {
    getSessionCount().then((count) => setSessionNumber(count + 1))
  }, [])

  const activeShots = shots.filter((s) => s.status === 'active')
  const prioritized = prioritizeShots(shots, assessments, lastPracticedMap, lastPracticedSessionAgo)
  const assessedCount = new Set(assessments.map((a) => a.shot_id)).size

  const rotation = sessionNumber !== null
    ? sortByRotation(prioritized, sessionNumber)
    : prioritized

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
              className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center text-accent font-semibold active:scale-95 transition-transform duration-150"
            >
              Start Session
            </Link>
            <Link
              to="/assess"
              className="p-4 rounded-xl bg-success/10 border border-success/30 text-center text-success font-semibold active:scale-95 transition-transform duration-150"
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
                {/* Rows */}
                {rotation.map((scored) => {
                  const { shot, aggregateScore, isAssessed, sessionsAgo } = scored
                  const primaryImage = getShotDisplayImage(shot)
                  const rates = ratesByShot.get(shot.id)
                  const dueAt = sessionNumber !== null ? nextDueSession(scored, sessionNumber) : 0
                  const isDueNow = sessionNumber !== null && dueAt === sessionNumber

                  return (
                    <Link
                      key={shot.id}
                      to={`/shots/${shot.slug}`}
                      className={`block px-3 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors ${
                        isDueNow ? 'bg-accent/5' : ''
                      }`}
                    >
                      {/* Top row: thumbnail + shot name + score */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-10 h-10 rounded-lg bg-surface-secondary overflow-hidden shrink-0">
                          {primaryImage ? (
                            <img
                              src={getImageUrl(primaryImage.storage_path)}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-secondary text-[10px]">
                              —
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm">{shot.title}</span>
                          <span className="text-[10px] text-on-surface-secondary">{FREQUENCY_LABELS[shot.frequency]}</span>
                        </div>
                        <span
                          className={`ml-auto inline-flex w-5 h-5 rounded-full text-[10px] font-bold items-center justify-center ${
                            !isAssessed
                              ? 'bg-on-surface-secondary/15 text-on-surface-secondary'
                              : aggregateScore === 1
                                ? 'bg-danger/15 text-danger'
                                : aggregateScore === 2
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-success/15 text-success'
                          }`}
                        >
                          {isAssessed ? aggregateScore : '?'}
                        </span>
                      </div>
                      {/* Bottom row: due session + sessions since last + sparkline */}
                      <div className="flex items-center pl-12 text-xs">
                        <span className={isDueNow ? 'text-accent font-semibold' : 'text-on-surface-secondary'}>
                          {isDueNow ? 'due now' : `due #${dueAt}`}
                        </span>
                        {sessionsAgo !== null && (
                          <span className="text-on-surface-secondary ml-3">
                            {`last: ${sessionsAgo} ago`}
                          </span>
                        )}
                        <span className="ml-auto flex items-center">
                          {rates && rates.length > 0 ? (
                            <Sparkline data={rates.map((r) => r.rate)} width={64} height={24} />
                          ) : (
                            <span className="text-on-surface-secondary">—</span>
                          )}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <p className="text-[10px] text-on-surface-secondary mt-2">
                Sorted by rotation schedule. Blue rows are due next session.
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
