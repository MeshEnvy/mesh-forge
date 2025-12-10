import { BuildDownloadButton } from "@/components/BuildDownloadButton"
import { Button } from "@/components/ui/button"
import { TARGETS } from "@/constants/targets"
import type { Doc } from "@/convex/_generated/dataModel"
import { ArtifactType, getArtifactFilenameBase } from "@/convex/lib/filename"
import modulesData from "@/convex/modules.json"
import { getImplicitDependencies, humanizeStatus } from "@/lib/utils"
import registryData from "@/public/registry.json"
import { CheckCircle, Copy, Loader2, Share2, X, XCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { navigate } from "vike/client/router"

interface BuildProgressProps {
  build: Doc<"builds">
  isAdmin?: boolean
  onRetry?: (buildId: Doc<"builds">["_id"]) => Promise<void>
  showActions?: boolean
}

export function BuildProgress({ build, isAdmin = false, onRetry, showActions = true }: BuildProgressProps) {
  const [shareUrlCopied, setShareUrlCopied] = useState(false)
  const [bashCopied, setBashCopied] = useState(false)
  const [showBashModal, setShowBashModal] = useState(false)

  const targetMeta = build.config.target ? TARGETS[build.config.target] : undefined
  const targetLabel = targetMeta?.name ?? build.config.target
  const status = build.status || "queued"

  const getStatusIcon = () => {
    if (status === "success") {
      return <CheckCircle className="w-6 h-6 text-green-500" />
    }
    if (status === "failure") {
      return <XCircle className="w-6 h-6 text-red-500" />
    }
    return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  }

  const getStatusColor = () => {
    if (status === "success") return "text-green-400"
    if (status === "failure") return "text-red-400"
    return "text-blue-400"
  }

  const githubActionUrl =
    build.githubRunId && build.githubRunId > 0
      ? `https://github.com/MeshEnvy/mesh-forge/actions/runs/${build.githubRunId}`
      : null

  const shareUrl = `${window.location.origin}/builds/new/${build.buildHash}`

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareUrlCopied(true)
      toast.success("Share link copied to clipboard")
      setTimeout(() => setShareUrlCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link", {
        description: "Please copy the URL manually",
      })
    }
  }

  const generateBashCommand = (): string => {
    const flags = computeFlagsFromConfig(build.config)
    const target = build.config.target
    const version = build.config.version
    const plugins = build.config.pluginsEnabled || []
    const commands = []

    // Generate directory name matching the download filename format (without .tar.gz extension)
    const dirName = getArtifactFilenameBase(version, target, build.buildHash, build.githubRunId, "source")

    // Clone firmware repository into named directory
    commands.push(`git clone --recursive https://github.com/meshtastic/firmware.git ${dirName}`)
    commands.push(`cd ${dirName}`)

    // Checkout the specific version
    commands.push(`git checkout ${version}`)

    // Update submodules after checkout
    commands.push(`git submodule update --init --recursive`)

    // Install PlatformIO if not already installed
    commands.push(`pip install platformio`)

    // Install mesh-plugin-manager
    commands.push(`pip install mesh-plugin-manager`)

    // Initialize mpm
    commands.push(`mpm init`)

    // Install plugins if any
    if (plugins.length > 0) {
      const pluginSlugs = plugins.map(plugin => {
        // Extract slug from "slug@version" format if present
        return plugin.includes("@") ? plugin.split("@")[0] : plugin
      })
      commands.push(`mpm install ${pluginSlugs.join(" ")}`)
    }

    // Set build flags and build
    if (flags) {
      commands.push(`export PLATFORMIO_BUILD_FLAGS="${flags}"`)
    }
    commands.push(`pio run -e ${target}`)

    return commands.join("\n")
  }

  const handleOpenBashModal = () => {
    setBashCopied(false)
    setShowBashModal(true)
  }

  const handleCopyBashFromModal = async () => {
    try {
      const bashCommand = generateBashCommand()
      await navigator.clipboard.writeText(bashCommand)
      setBashCopied(true)
      toast.success("Bash command copied to clipboard")
      setTimeout(() => setBashCopied(false), 2000)
    } catch {
      toast.error("Failed to copy command", {
        description: "Please copy the command manually",
      })
    }
  }

  // Compute build flags from config (same logic as computeFlagsFromConfig in convex/builds.ts)
  const computeFlagsFromConfig = (config: typeof build.config): string => {
    return Object.keys(config.modulesExcluded)
      .sort()
      .filter(module => config.modulesExcluded[module])
      .map((moduleExcludedName: string) => `-D${moduleExcludedName}=1`)
      .join(" ")
  }

  const handleRetry = async () => {
    if (!build?._id || !onRetry) return
    try {
      await onRetry(build._id)
    } catch (error) {
      toast.error("Failed to retry build", {
        description: String(error),
      })
    }
  }

  // Get excluded modules
  const excludedModules = modulesData.modules.filter(module => build.config.modulesExcluded[module.id] === true)

  // Get explicitly selected plugins from stored config
  // The stored config only contains explicitly selected plugins (not resolved dependencies)
  const explicitPluginSlugs = (build.config.pluginsEnabled || []).map(pluginId => {
    // Extract slug from "slug@version" format if present
    return pluginId.includes("@") ? pluginId.split("@")[0] : pluginId
  })

  // Get implicit dependencies (dependencies that are not explicitly selected)
  const implicitDeps = getImplicitDependencies(
    explicitPluginSlugs,
    registryData as Record<string, { dependencies?: Record<string, string> }>
  )

  // Separate explicit and implicit plugins
  const explicitPlugins: Array<{
    id: string
    name: string
    description: string
    version: string
  }> = []
  const implicitPlugins: Array<{
    id: string
    name: string
    description: string
    version: string
  }> = []

  // Process explicitly selected plugins
  ;(build.config.pluginsEnabled || []).forEach(pluginId => {
    // Extract slug from "slug@version" format if present
    const slug = pluginId.includes("@") ? pluginId.split("@")[0] : pluginId
    const pluginData = (registryData as Record<string, { name: string; description: string; version: string }>)[slug]
    const pluginInfo = {
      id: slug,
      name: pluginData?.name || slug,
      description: pluginData?.description || "",
      version: pluginId.includes("@") ? pluginId.split("@")[1] : pluginData?.version || "",
    }
    explicitPlugins.push(pluginInfo)
  })

  // Process implicit dependencies (resolved but not in stored config)
  for (const slug of implicitDeps) {
    const pluginData = (registryData as Record<string, { name: string; description: string; version: string }>)[slug]
    if (pluginData) {
      implicitPlugins.push({
        id: slug,
        name: pluginData.name || slug,
        description: pluginData.description || "",
        version: pluginData.version || "",
      })
    }
  }

  return (
    <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                {getStatusIcon()}
                <a
                  href={`/builds/${build.buildHash}`}
                  onClick={e => {
                    e.preventDefault()
                    navigate(`/builds/${build.buildHash}`)
                  }}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {targetLabel}
                </a>
                {status !== "success" && status !== "failure" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (githubActionUrl) {
                        window.open(githubActionUrl, "_blank", "noopener,noreferrer")
                      }
                    }}
                    disabled={!githubActionUrl}
                    className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold ${getStatusColor()} bg-slate-800 border border-slate-700 hover:bg-slate-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ cursor: githubActionUrl ? "pointer" : "not-allowed" }}
                    title={githubActionUrl ? "View GitHub Actions run" : "GitHub run not available"}
                  >
                    {humanizeStatus(status)}
                  </button>
                )}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span className="font-mono">{build.config.target}</span>
                <span>•</span>
                <span>v{build.config.version}</span>
                <span>•</span>
                <span>
                  {build.completedAt
                    ? new Date(build.completedAt).toLocaleString()
                    : new Date(build.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
            {showActions && (
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate(`/builds/new/${build.buildHash}`)}
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-800"
                  aria-label="Clone"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 512 512"
                    className="w-4 h-4"
                    fill="currentColor"
                  >
                    <path d="M472 16H160a24.027 24.027 0 0 0-24 24v312a24.027 24.027 0 0 0 24 24h312a24.027 24.027 0 0 0 24-24V40a24.027 24.027 0 0 0-24-24m-8 328H168V48h296Z" />
                    <path d="M344 464H48V168h56v-32H40a24.027 24.027 0 0 0-24 24v312a24.027 24.027 0 0 0 24 24h312a24.027 24.027 0 0 0 24-24v-64h-32Z" />
                  </svg>
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="border-slate-600 hover:bg-slate-800"
                  aria-label={shareUrlCopied ? "Copied!" : "Share Build"}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          {excludedModules.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm mt-2">
              <span className="text-slate-500">Excluded Modules:</span>
              {excludedModules.map((module, index) => (
                <span key={module.id}>
                  <span className="text-slate-300">{module.name}</span>
                  {index < excludedModules.length - 1 && <span className="text-slate-500">,</span>}
                </span>
              ))}
            </div>
          )}
          {(explicitPlugins.length > 0 || implicitPlugins.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm mt-2">
              <span className="text-slate-500">Plugins:</span>
              {explicitPlugins.map((plugin, index) => (
                <span key={plugin.id}>
                  <a href={`/plugins/${plugin.id}`} className="text-cyan-400 hover:text-cyan-300 underline">
                    {plugin.name}
                  </a>
                  {(index < explicitPlugins.length - 1 || implicitPlugins.length > 0) && (
                    <span className="text-slate-500">,</span>
                  )}
                </span>
              ))}
              {implicitPlugins.map((plugin, index) => (
                <span key={plugin.id}>
                  <a href={`/plugins/${plugin.id}`} className="text-cyan-400 hover:text-cyan-300 underline">
                    {plugin.name}
                  </a>
                  {index < implicitPlugins.length - 1 && <span className="text-slate-500">,</span>}
                </span>
              ))}
            </div>
          )}
          {build && (build.githubRunId || (build.githubRunIdHistory?.length ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">
                Run History
                {(build.githubRunIdHistory?.length ?? 0) > 0 &&
                  ` (${(build.githubRunIdHistory?.length ?? 0) + (build.githubRunId ? 1 : 0)} total)`}
              </span>
              {build.githubRunId && (
                <a
                  href={`https://github.com/MeshEnvy/mesh-forge/actions/runs/${build.githubRunId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline font-semibold"
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
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  {id}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Actions */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          {status === "success" && build.buildHash && (
            <BuildDownloadButton
              build={build}
              type={ArtifactType.Firmware}
              className="bg-cyan-600 hover:bg-cyan-700"
              compact={true}
            />
          )}
          {build.buildHash && (
            <>
              <BuildDownloadButton
                build={build}
                type={ArtifactType.Source}
                variant="outline"
                className="bg-slate-700 hover:bg-slate-600"
                compact={true}
              />
              <Button onClick={handleOpenBashModal} variant="outline" className="bg-slate-700 hover:bg-slate-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                >
                  <path d="m6.75 7.5l3 2.25l-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25" />
                </svg>
                Local Build Script (Bash)
              </Button>
            </>
          )}
          {isAdmin && build && onRetry && (
            <Button onClick={handleRetry} className="bg-cyan-600 hover:bg-cyan-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                className="w-4 h-4 mr-2"
                fill="currentColor"
              >
                <path d="M11.896 18a.75.75 0 0 1-.75.75c-3.792 0-6.896-3.005-6.896-6.75s3.104-6.75 6.896-6.75c3.105 0 5.749 2.015 6.605 4.801l.603-1.02a.75.75 0 0 1 1.292.763l-1.63 2.755a.75.75 0 0 1-1.014.272L14.18 11.23a.75.75 0 1 1 .737-1.307l1.472.83c-.574-2.288-2.691-4.003-5.242-4.003C8.149 6.75 5.75 9.117 5.75 12s2.399 5.25 5.396 5.25a.75.75 0 0 1 .75.75" />
              </svg>
              Retry Build
            </Button>
          )}
        </div>
      )}

      {/* Status Messages */}
      {status === "failure" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-medium text-red-200">
            Build failed. Please try tweaking your configuration or re-running the build.
          </p>
        </div>
      )}

      {status !== "success" && status !== "failure" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-100">
          <p className="font-medium text-blue-200">
            This build is still running. Leave this tab open or come back later using the URL above.
          </p>
        </div>
      )}

      {/* Bash Script Modal */}
      {showBashModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setShowBashModal(false)
            setBashCopied(false)
          }}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Build Script</h3>
              <button
                onClick={() => {
                  setShowBashModal(false)
                  setBashCopied(false)
                }}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="bg-slate-950 border border-slate-800 rounded p-4 text-sm text-slate-300 font-mono overflow-x-auto">
                <code>{generateBashCommand()}</code>
              </pre>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
              <Button
                onClick={() => {
                  setShowBashModal(false)
                  setBashCopied(false)
                }}
                variant="outline"
                className="border-slate-600 hover:bg-slate-800"
              >
                Close
              </Button>
              <Button onClick={handleCopyBashFromModal} className="bg-cyan-600 hover:bg-cyan-700">
                {bashCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Script
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
