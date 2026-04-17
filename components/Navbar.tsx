import favicon from "@/assets/favicon-96x96.png"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useAuthActions } from "@convex-dev/auth/react"
import { Authenticated, useQuery } from "convex/react"
import { Link } from "react-router-dom"

export default function Navbar() {
  const { signOut } = useAuthActions()
  const isAdmin = useQuery(api.admin.isAdmin)

  return (
    <nav className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={favicon} alt="MeshForge logo" className="h-10 w-10 rounded-lg" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                MeshForge
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Authenticated>
                {isAdmin && (
                  <Link to="/admin" className="text-slate-300 hover:text-white transition-colors">
                    Admin
                  </Link>
                )}
              </Authenticated>
            </div>
          </div>
          <div className="flex items-center gap-4">
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
