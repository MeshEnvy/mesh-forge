import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Navbar from './components/Navbar'
import BuildDetail from './pages/BuildDetail'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import ProfileDetail from './pages/ProfileDetail'
import ProfileEditorPage from './pages/ProfileEditorPage'
import ProfileFlash from './pages/ProfileFlash'

function App() {
  return (
    <BrowserRouter>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/profiles/:id" element={<ProfileDetail />} />
          <Route
            path="/profiles/:id/flash/:target"
            element={<ProfileFlash />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Unauthenticated>

      <Authenticated>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/builds/:buildId" element={<BuildDetail />} />
          <Route
            path="/dashboard/profiles/:id"
            element={<ProfileEditorPage />}
          />
          <Route path="/profiles/:id" element={<ProfileDetail />} />
          <Route
            path="/profiles/:id/flash/:target"
            element={<ProfileFlash />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Authenticated>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
