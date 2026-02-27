import { Outlet, NavLink, useLocation, useNavigate } from 'react-router'
import { useEffect, useState, useRef } from 'react'
import { Dashboard } from '../pages/Dashboard'
import { Gallery } from '../pages/Gallery'
import { SessionSetup } from '../pages/SessionSetup'
import { SessionHistory } from '../pages/SessionHistory'
import { SessionReview } from '../pages/SessionReview'
import { Assessment } from '../pages/Assessment'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/shots', label: 'Shots' },
  { to: '/session/new', label: 'Train' },
  { to: '/sessions', label: 'History' },
  { to: '/assess', label: 'Assess' },
]

// Routes that are rendered persistently (not via Outlet)
const tabRoutes = new Set(['/', '/shots', '/session/new', '/sessions', '/assess'])

// Match /session/:id/review — these are part of the History tab
const reviewPattern = /^\/session\/([^/]+)\/review$/

export function Layout() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('shotdb-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('shotdb-theme', dark ? 'dark' : 'light')
  }, [dark])

  const location = useLocation()
  const reviewMatch = location.pathname.match(reviewPattern)
  const reviewSessionId = reviewMatch?.[1] ?? null
  const isHistoryTab = location.pathname === '/sessions' || reviewSessionId !== null
  const isTabRoute = tabRoutes.has(location.pathname) || isHistoryTab

  const navigate = useNavigate()

  // Keep the last-viewed review session mounted so it persists when
  // the user navigates to a shot detail page and then back.
  const [mountedReviewId, setMountedReviewId] = useState<string | null>(null)

  // Track the last History-tab path so the tab button can restore it
  const lastHistoryPath = useRef('/sessions')

  useEffect(() => {
    if (reviewSessionId) {
      setMountedReviewId(reviewSessionId)
      lastHistoryPath.current = location.pathname
    } else if (location.pathname === '/sessions') {
      setMountedReviewId(null)
      lastHistoryPath.current = '/sessions'
    }
  }, [reviewSessionId, location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <NavLink to="/" className="text-lg font-bold text-on-surface">
          ShotDB
        </NavLink>
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-lg bg-surface-secondary text-on-surface-secondary hover:text-on-surface transition-colors active:scale-95 transition-transform duration-150"
          aria-label="Toggle dark mode"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </header>

      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* Persistent tab pages — always mounted, toggled via CSS */}
          <div style={{ display: location.pathname === '/' ? 'contents' : 'none' }}>
            <Dashboard />
          </div>
          <div style={{ display: location.pathname === '/shots' ? 'contents' : 'none' }}>
            <Gallery />
          </div>
          <div style={{ display: location.pathname === '/session/new' ? 'contents' : 'none' }}>
            <SessionSetup />
          </div>
          {/* History tab — includes both session list and review, each persisted */}
          <div style={{ display: location.pathname === '/sessions' ? 'contents' : 'none' }}>
            <SessionHistory />
          </div>
          {mountedReviewId && (
            <div style={{ display: reviewSessionId ? 'contents' : 'none' }}>
              <SessionReview sessionId={mountedReviewId} />
            </div>
          )}
          <div style={{ display: location.pathname === '/assess' ? 'contents' : 'none' }}>
            <Assessment />
          </div>

          {/* Non-tab routes render via Outlet */}
          {!isTabRoute && (
            <div className="animate-fade-in">
              <Outlet />
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto flex justify-around py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            // History tab should stay active when viewing a session review
            const isActive =
              item.to === '/sessions'
                ? isHistoryTab
                : item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)

            // History tab navigates to the last page within that tab
            if (item.to === '/sessions') {
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(lastHistoryPath.current)}
                  className={`flex flex-col items-center px-3 py-1.5 text-sm transition-all duration-150 active:scale-90 ${
                    isActive
                      ? 'text-accent font-semibold'
                      : 'text-on-surface-secondary'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={() =>
                  `flex flex-col items-center px-3 py-1.5 text-sm transition-all duration-150 active:scale-90 ${
                    isActive
                      ? 'text-accent font-semibold'
                      : 'text-on-surface-secondary'
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
