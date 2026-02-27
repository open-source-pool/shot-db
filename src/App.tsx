import { Routes, Route } from 'react-router'
import { Layout } from './components/Layout'
import { ShotDetail } from './pages/ShotDetail'
import { SessionActive } from './pages/SessionActive'
import { SessionReview } from './pages/SessionReview'
import { AddShot } from './pages/AddShot'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Tab routes — rendered persistently in Layout, not here */}
        <Route index element={null} />
        <Route path="shots" element={null} />
        <Route path="session/new" element={null} />
        <Route path="sessions" element={null} />
        <Route path="assess" element={null} />

        {/* Non-tab routes — rendered via Outlet */}
        <Route path="shots/:slug" element={<ShotDetail />} />
        <Route path="session/:id" element={<SessionActive />} />
        <Route path="session/:id/review" element={<SessionReview />} />
        <Route path="add-shot" element={<AddShot />} />
      </Route>
    </Routes>
  )
}
