import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Navbar from './components/Navbar'

const Admin = lazy(() => import('./pages/Admin'))
const BuildNew = lazy(() => import('./pages/BuildNew'))
const BuildProgress = lazy(() => import('./pages/BuildProgress'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const ProfileDetail = lazy(() => import('./pages/ProfileDetail'))
const ProfileEditorPage = lazy(() => import('./pages/ProfileEditorPage'))
const ProfileFlash = lazy(() => import('./pages/ProfileFlash'))

function ConditionalNavbar() {
  const location = useLocation()
  if (location.pathname === '/') {
    return null
  }
  return <Navbar />
}

function App() {
  return (
    <BrowserRouter>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <ConditionalNavbar />
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/builds/new/:buildHash" element={<BuildNew />} />
            <Route path="/builds/new" element={<BuildNew />} />
            <Route path="/builds/:buildHash" element={<BuildProgress />} />
            <Route path="/profiles/:id" element={<ProfileDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Unauthenticated>

      <Authenticated>
        <ConditionalNavbar />
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/builds/new/:buildHash" element={<BuildNew />} />
            <Route path="/builds/new" element={<BuildNew />} />
            <Route path="/builds/:buildHash" element={<BuildProgress />} />
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
        </Suspense>
      </Authenticated>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
