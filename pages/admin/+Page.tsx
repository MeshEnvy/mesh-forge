import { BuildDownloadButton } from "@/components/BuildDownloadButton"
import { Button } from "@/components/ui/button"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"
import { navigate } from "vike/client/router"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { ArtifactType } from "../../convex/builds"

type FilterType = "all" | "failed"

export default function Admin() {
  const [filter, setFilter] = useState<FilterType>("failed")
  const isAdmin = useQuery(api.admin.isAdmin)
  const failedBuilds = useQuery(api.admin.listFailedBuilds)
  const allBuilds = useQuery(api.admin.listAllBuilds)
  const retryBuild = useMutation(api.admin.retryBuild)

  const builds = filter === "failed" ? failedBuilds : allBuilds

  // Show loading state
  if (isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  // Redirect if not admin
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-4">You must be an admin to access this page.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    )
  }

  const handleRetry = async (buildId: Id<"builds">) => {
    try {
      await retryBuild({ buildId })
      toast.success("Build retry initiated", {
        description: "The build has been queued with the latest YAML.",
      })
    } catch (error) {
      toast.error("Failed to retry build", {
        description: String(error),
      })
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: {
        bg: "bg-green-500/20",
        text: "text-green-400",
        label: "Success",
      },
      failure: { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" },
      queued: {
        bg: "bg-yellow-500/20",
        text: "text-yellow-400",
        label: "Queued",
      },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      bg: "bg-slate-500/20",
      text: "text-slate-400",
      label: status,
    }
    return <span className={`px-2 py-1 ${config.bg} ${config.text} rounded text-sm`}>{config.label}</span>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin - Builds</h1>
        <p className="text-slate-400 mb-4">
          View and manage builds. Retry failed builds with the latest GitHub Actions workflow YAML.
        </p>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-cyan-600 hover:bg-cyan-700" : ""}
          >
            All Builds
          </Button>
          <Button
            variant={filter === "failed" ? "default" : "outline"}
            onClick={() => setFilter("failed")}
            className={filter === "failed" ? "bg-cyan-600 hover:bg-cyan-700" : ""}
          >
            Failed Builds
          </Button>
        </div>
      </header>

      <main>
        {builds === undefined ? (
          <div className="text-center text-slate-400 py-12">Loading builds...</div>
        ) : builds.length === 0 ? (
          <div className="text-center text-slate-400 py-12">No {filter === "failed" ? "failed " : ""}builds found.</div>
        ) : (
          <div className="space-y-4">
            {builds.map(build => (
              <div key={build._id} className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-mono font-semibold text-white">
                      {build.buildHash.substring(0, 8)}
                    </span>
                    {getStatusBadge(build.status)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(`/builds/${build.buildHash}`)}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 hover:bg-slate-800"
                    >
                      Public View
                    </Button>
                    <Button
                      onClick={() => navigate(`/builds/new/${build.buildHash}`)}
                      variant="outline"
                      size="sm"
                      className="border-slate-600 hover:bg-slate-800"
                    >
                      Clone
                    </Button>
                    <Button onClick={() => handleRetry(build._id)} className="bg-cyan-600 hover:bg-cyan-700" size="sm">
                      Re-run Build
                    </Button>
                  </div>
                </div>

                {/* Build Configuration Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-slate-500">Target</span>
                      <div className="text-sm font-mono text-white mt-1">{build.config.target}</div>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500">Version</span>
                      <div className="text-sm font-mono text-white mt-1">{build.config.version}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-slate-500">{build.completedAt ? "Completed" : "Started"}</span>
                      <div className="text-sm text-white mt-1">
                        {build.completedAt
                          ? formatDate(build.completedAt)
                          : build.startedAt
                            ? formatDate(build.startedAt)
                            : "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Run History Section */}
                {(build.githubRunId || (build.githubRunIdHistory?.length ?? 0) > 0) && (
                  <div className="mb-4 pb-4 border-b border-slate-800">
                    <span className="text-xs text-slate-500 mb-2 block">
                      Run History
                      {(build.githubRunIdHistory?.length ?? 0) > 0 &&
                        ` (${(build.githubRunIdHistory?.length ?? 0) + (build.githubRunId ? 1 : 0)} total)`}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {build.githubRunId && (
                        <a
                          href={`https://github.com/MeshEnvy/mesh-forge/actions/runs/${build.githubRunId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold"
                          title="Current run"
                        >
                          {build.githubRunId}
                        </a>
                      )}
                      {build.githubRunIdHistory?.map(id => (
                        <a
                          key={id}
                          href={`https://github.com/MeshEnvy/mesh-forge/actions/runs/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                        >
                          {id}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Actions */}
                {build.buildHash && (
                  <div className="flex gap-3">
                    {build.status === "success" && <BuildDownloadButton build={build} type={ArtifactType.Firmware} />}
                    <BuildDownloadButton build={build} type={ArtifactType.Source} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
