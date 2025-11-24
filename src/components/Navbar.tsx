import { useAuthActions } from '@convex-dev/auth/react'
import { Authenticated, Unauthenticated } from 'convex/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const { signIn, signOut } = useAuthActions()

  return (
    <nav className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              Mesh Forge
            </Link>
            <div className="flex items-center gap-4">
              <Authenticated>
                <Link
                  to="/dashboard"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
              </Authenticated>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Unauthenticated>
              <Button
                onClick={() =>
                  signIn('google', { redirectTo: window.location.href })
                }
                className="bg-white text-slate-900 hover:bg-slate-200"
              >
                Sign in
              </Button>
            </Unauthenticated>
            <Authenticated>
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </Authenticated>
          </div>
        </div>
      </div>
    </nav>
  )
}
