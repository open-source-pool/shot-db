import { Link } from 'react-router'
import { useSessions } from '../hooks/useSessions'
import type { SessionBlock } from '../types'

export function SessionHistory() {
  const { sessions, loading } = useSessions()

  if (loading) return <div className="p-4 text-on-surface-secondary">Loading...</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Session History</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-on-surface-secondary mb-3">No sessions yet.</p>
          <Link
            to="/session/new"
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm"
          >
            Start your first session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => {
            const blocks = (session.blocks ?? []) as SessionBlock[]
            const shotBlocks = blocks.filter(
              (b) => b.block_type !== 'warmup' && b.block_type !== 'cooldown'
            )
            const totalAttempts = shotBlocks.reduce((s, b) => s + (b.attempts ?? 0), 0)
            const totalSuccesses = shotBlocks.reduce((s, b) => s + (b.successes ?? 0), 0)
            const rate = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : null
            const shotNames = [
              ...new Set(
                shotBlocks
                  .map((b) => (b.shot as { title?: string } | undefined)?.title)
                  .filter(Boolean)
              ),
            ]

            return (
              <Link
                key={session.id}
                to={`/session/${session.id}/review`}
                className="block p-4 rounded-xl border border-border bg-surface-secondary hover:border-accent transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold text-sm">
                      Session {sessions.length - i}
                    </span>
                    <span className="text-xs text-on-surface-secondary ml-2">
                      {session.duration_minutes} min
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-secondary">
                    {new Date(session.started_at).toLocaleDateString()}
                  </span>
                </div>

                {shotNames.length > 0 && (
                  <p className="text-xs text-on-surface-secondary mb-2 truncate">
                    {shotNames.join(', ')}
                  </p>
                )}

                <div className="flex gap-4 text-xs">
                  <span>{totalAttempts} attempts</span>
                  <span className="text-success">{totalSuccesses} hits</span>
                  {rate !== null && <span>{rate}% rate</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
