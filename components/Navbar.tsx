import favicon from "@/assets/favicon-96x96.png"
import { DiscordButton } from "@/components/DiscordButton"
import { RedditButton } from "@/components/RedditButton"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { useAuthActions } from "@convex-dev/auth/react"
import { Authenticated, Unauthenticated, useQuery } from "convex/react"

export default function Navbar() {
  const { signOut, signIn } = useAuthActions()
  const isAdmin = useQuery(api.admin.isAdmin)

  return (
    <nav className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={favicon} alt="Mesh Forge logo" className="h-10 w-10 rounded-lg" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                Mesh Forge
              </span>
            </a>
            <div className="flex items-center gap-4">
              <a href="/docs" className="text-slate-300 hover:text-white transition-colors">
                Docs
              </a>
              <a href="/plugins" className="text-slate-300 hover:text-white transition-colors">
                Plugins
              </a>
              <Authenticated>
                {isAdmin && (
                  <a href="/admin" className="text-slate-300 hover:text-white transition-colors">
                    Admin
                  </a>
                )}
              </Authenticated>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DiscordButton
              variant="default"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-purple-500/50"
            />
            <RedditButton
              variant="default"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-lg shadow-orange-500/50"
            />
            <Unauthenticated>
              <Button
                onClick={() => signIn("google", { redirectTo: window.location.href })}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                Sign In
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
