import { Routes, Route } from 'react-router'
import { Layout } from './components/Layout'
import { Gallery } from './pages/Gallery'
import { ShotDetail } from './pages/ShotDetail'
import { Assessment } from './pages/Assessment'
import { SessionSetup } from './pages/SessionSetup'
import { SessionActive } from './pages/SessionActive'
import { SessionHistory } from './pages/SessionHistory'
import { SessionReview } from './pages/SessionReview'
import { Dashboard } from './pages/Dashboard'
import { AddShot } from './pages/AddShot'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="shots" element={<Gallery />} />
        <Route path="shots/:slug" element={<ShotDetail />} />
        <Route path="assess" element={<Assessment />} />
        <Route path="session/new" element={<SessionSetup />} />
        <Route path="session/:id" element={<SessionActive />} />
        <Route path="session/:id/review" element={<SessionReview />} />
        <Route path="sessions" element={<SessionHistory />} />
        <Route path="add-shot" element={<AddShot />} />
      </Route>
    </Routes>
  )
}
