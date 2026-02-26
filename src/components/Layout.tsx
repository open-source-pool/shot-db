import { Outlet, NavLink } from 'react-router'
import { useEffect, useState } from 'react'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/shots', label: 'Shots' },
  { to: '/session/new', label: 'Train' },
  { to: '/sessions', label: 'History' },
  { to: '/assess', label: 'Assess' },
]

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <NavLink to="/" className="text-lg font-bold text-on-surface">
          ShotDB
        </NavLink>
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-lg bg-surface-secondary text-on-surface-secondary hover:text-on-surface transition-colors"
          aria-label="Toggle dark mode"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </header>

      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto flex justify-around py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'text-accent font-semibold'
                    : 'text-on-surface-secondary'
                }`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
