import { Routes, Route } from 'react-router'
import { Layout } from './components/Layout'
import { ShotDetail } from './pages/ShotDetail'
import { SessionActive } from './pages/SessionActive'
import { AddShot } from './pages/AddShot'
import { Auth } from './pages/Auth'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="p-4 text-on-surface-secondary">Loading...</div>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Tab routes — rendered persistently in Layout, not here */}
        <Route index element={null} />
        <Route path="shots" element={null} />
        <Route path="session/new" element={null} />
        <Route path="sessions" element={null} />
        <Route path="assess" element={null} />

        {/* Session review — rendered persistently in Layout as part of History tab */}
        <Route path="session/:id/review" element={null} />

        {/* Non-tab routes — rendered via Outlet */}
        <Route path="shots/:slug" element={<ShotDetail />} />
        <Route path="session/:id" element={<SessionActive />} />
        <Route path="add-shot" element={<AddShot />} />
      </Route>
    </Routes>
  )
}
