import { useState } from 'react'
import { Github } from 'lucide-react'
import { supabase } from '../lib/supabase'

function getOAuthRedirectTo(): string {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  if (configured) return configured

  const baseUrl = import.meta.env.BASE_URL
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    const localPort = window.location.port || '5173'
    return new URL(baseUrl, `http://localhost:${localPort}`).toString()
  }

  return new URL(baseUrl, window.location.origin).toString()
}

export function Auth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithProvider(provider: 'github') {
    setError(null)
    setLoading(true)

    const redirectTo = getOAuthRedirectTo()
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (signInError) setError(signInError.message)

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 rounded-xl border border-border bg-surface space-y-4">
        <h1 className="text-xl font-bold text-on-surface">ShotDB</h1>
        <p className="text-sm text-on-surface-secondary">
          Sign in to continue
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void signInWithProvider('github')}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Github size={16} aria-hidden="true" />
            Continue with GitHub
          </button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}
