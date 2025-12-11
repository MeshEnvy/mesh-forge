import Builder from "@/components/Builder"
import { BuildProgress } from "@/components/BuildProgress"
import { GiscusComments } from "@/components/GiscusComments"
import { api } from "@/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { usePageContext } from "vike-react/usePageContext"

export default function BuildsPage() {
  const pageContext = usePageContext()
  const urlSearchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  const cloneHash = urlSearchParams?.get("clone")
  const buildId = urlSearchParams?.get("id")
  const pluginParam = urlSearchParams?.get("plugin")

  // If we have a build ID, show the build progress page
  if (buildId) {
    return <BuildViewPage buildHash={buildId} />
  }

  // Otherwise, show the builder (handles clone and plugin params)
  return <Builder cloneHash={cloneHash || undefined} pluginParam={pluginParam || undefined} />
}

function BuildViewPage({ buildHash }: { buildHash: string }) {
  const build = useQuery(api.builds.getByHash, { buildHash })
  const isAdmin = useQuery(api.admin.isAdmin)
  const retryBuild = useMutation(api.admin.retryBuild)

  if (build === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (!build) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
            <p className="text-slate-300">
              No build found for hash <span className="font-mono">{buildHash}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleRetry = async (buildId: typeof build._id) => {
    try {
      await retryBuild({ buildId })
      toast.success("Build retry initiated", {
        description: "The build has been queued with the latest YAML.",
      })
    } catch (error) {
      toast.error("Failed to retry build", {
        description: String(error),
      })
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <BuildProgress build={build} isAdmin={isAdmin === true} onRetry={handleRetry} />
        <GiscusComments build={build} />
      </div>
    </div>
  )
}
