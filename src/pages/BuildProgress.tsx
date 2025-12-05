import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Share2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BuildDownloadButton } from '@/components/BuildDownloadButton'
import { Button } from '@/components/ui/button'
import { humanizeStatus } from '@/lib/utils'
import { api } from '../../convex/_generated/api'
import { ArtifactType } from '../../convex/builds'
import modulesData from '../../convex/modules.json'
import registryData from '../../registry/registry.json'
import { TARGETS } from '../constants/targets'

export default function BuildProgress() {
  const { buildHash } = useParams<{ buildHash: string }>()
  const navigate = useNavigate()
  const build = useQuery(
    api.builds.getByHash,
    buildHash ? { buildHash } : 'skip'
  )
  const isAdmin = useQuery(api.admin.isAdmin)
  const retryBuild = useMutation(api.admin.retryBuild)
  const [shareUrlCopied, setShareUrlCopied] = useState(false)

  if (!buildHash) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-300">
            Build hash missing.{' '}
            <Link to="/builds/new" className="text-cyan-400">
              Start a new build
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

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
          <Link
            to={`/builds/new/${buildHash}`}
            className="inline-flex items-center text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quick Build
          </Link>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
            <p className="text-slate-300">
              No build found for hash{' '}
              <span className="font-mono">{buildHash}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const targetMeta = build.config.target
    ? TARGETS[build.config.target]
    : undefined
  const targetLabel = targetMeta?.name ?? build.config.target
  const status = build.status || 'queued'

  const getStatusIcon = () => {
    if (status === 'success') {
      return <CheckCircle className="w-6 h-6 text-green-500" />
    }
    if (status === 'failure') {
      return <XCircle className="w-6 h-6 text-red-500" />
    }
    return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  }

  const getStatusColor = () => {
    if (status === 'success') return 'text-green-400'
    if (status === 'failure') return 'text-red-400'
    return 'text-blue-400'
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
      toast.success('Share link copied to clipboard')
      setTimeout(() => setShareUrlCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link', {
        description: 'Please copy the URL manually',
      })
    }
  }

  // Compute build flags from config (same logic as computeFlagsFromConfig in convex/builds.ts)
  const computeFlagsFromConfig = (config: typeof build.config): string => {
    return Object.keys(config.modulesExcluded)
      .sort()
      .filter((module) => config.modulesExcluded[module])
      .map((moduleExcludedName: string) => `-D${moduleExcludedName}=1`)
      .join(' ')
  }

  // Generate GitHub discussion URL with prefilled body
  const generateDiscussionUrl = (): string => {
    const flags = computeFlagsFromConfig(build.config)
    const plugins = build.config.pluginsEnabled?.join(', ') || '(none)'
    const timestamp = new Date(build.startedAt).toISOString()
    const githubRunLink = githubActionUrl
      ? `[View run](${githubActionUrl})`
      : '(not available)'
    const buildPageUrl = `${window.location.origin}/builds/${build.buildHash}`

    // Format plugins as +plugin@version
    const formattedPlugins = build.config.pluginsEnabled
      ?.map((plugin) => {
        // Plugin might be "slug@version" or just "slug"
        return plugin.includes('@') ? `+${plugin}` : `+${plugin}`
      })
      .join(' ') || ''

    const bracketContent = [
      build.config.target,
      `v${build.config.version}`,
      ...(formattedPlugins ? [formattedPlugins] : []),
    ].join(' ')

    const discussionTitle = `Build ${build.status === 'failure' ? 'Failed' : 'Issue'}: ${targetLabel} [${bracketContent}]`

    const discussionBody = `## Build ${build.status === 'failure' ? 'Failed' : 'Information'}

**Build Hash**: \`${build.buildHash}\`
**Target Board**: ${build.config.target}
**Firmware Version**: ${build.config.version}
**Build Flags**: ${flags || '(none)'}
**Plugins**: ${plugins}
**Build Timestamp**: ${timestamp}

**Build Page**: [View build page](${buildPageUrl})
**GitHub Run**: ${githubRunLink}

## Additional Information
(Please add any additional details about the issue here)`

    const baseUrl = 'https://github.com/MeshEnvy/mesh-forge/discussions/new'
    const params = new URLSearchParams({
      category: 'q-a',
      title: discussionTitle,
      body: discussionBody,
    })

    return `${baseUrl}?${params.toString()}`
  }

  const handleReportIssue = () => {
    window.open(generateDiscussionUrl(), '_blank', 'noopener,noreferrer')
  }

  const handleRetry = async () => {
    if (!build?._id) return
    try {
      await retryBuild({ buildId: build._id })
      toast.success('Build retry initiated', {
        description: 'The build has been queued with the latest YAML.',
      })
    } catch (error) {
      toast.error('Failed to retry build', {
        description: String(error),
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: {
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        label: 'Success',
      },
      failure: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
      queued: {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        label: 'Queued',
      },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      label: status,
    }
    return (
      <span className={`px-2 py-1 ${config.bg} ${config.text} rounded text-sm`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  // Get excluded modules
  const excludedModules = modulesData.modules.filter(
    (module) => build.config.modulesExcluded[module.id] === true
  )

  // Get enabled plugins
  const enabledPlugins = (build.config.pluginsEnabled || []).map((pluginId) => {
    // Extract slug from "slug@version" format if present
    const slug = pluginId.includes('@') ? pluginId.split('@')[0] : pluginId
    const pluginData = (registryData as Record<string, { name: string; description: string; version: string }>)[slug]
    return {
      id: slug,
      name: pluginData?.name || slug,
      description: pluginData?.description || '',
      version: pluginId.includes('@') ? pluginId.split('@')[1] : pluginData?.version || '',
    }
  })

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            to={`/builds/new/${build.buildHash}`}
            className="inline-flex items-center text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quick Build
          </Link>
        </div>

        <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {getStatusIcon()}
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-500">
                  Target
                </p>
                <h2 className="text-2xl font-semibold">{targetLabel}</h2>
                <div className="flex items-center gap-2 text-slate-400 mt-1 text-sm">
                  <span className={getStatusColor()}>
                    {humanizeStatus(status)}
                  </span>
                  <span>•</span>
                  <span>{new Date(build.updatedAt).toLocaleString()}</span>
                  {githubActionUrl && (
                    <>
                      <span>•</span>
                      <a
                        href={githubActionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-slate-300"
                      >
                        View run
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReportIssue}
                variant="outline"
                className="border-slate-600 hover:bg-slate-800"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Report a Problem
              </Button>
              <Button
                onClick={handleShare}
                className="bg-green-600 hover:bg-green-700"
              >
                <Share2 className="w-4 h-4 mr-2" />
                {shareUrlCopied ? 'Copied!' : 'Share Build'}
              </Button>
            </div>
          </div>

          {/* Admin Controls Section */}
          {isAdmin === true && build && (
            <div className="border-t border-slate-800 pt-4 mt-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Admin Controls</h3>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono font-semibold text-white">
                      {build.buildHash.substring(0, 8)}
                    </span>
                    {getStatusBadge(build.status)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/builds/new/${build.buildHash}`)}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 hover:bg-slate-800"
                  >
                    Clone
                  </Button>
                  <Button
                    onClick={handleRetry}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    size="sm"
                  >
                    Re-run Build
                  </Button>
                </div>
              </div>

              {/* Build Configuration Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-slate-500">Target</span>
                    <div className="text-sm font-mono text-white mt-1">
                      {build.config.target}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Version</span>
                    <div className="text-sm font-mono text-white mt-1">
                      {build.config.version}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-slate-500">
                      {build.completedAt ? 'Completed' : 'Started'}
                    </span>
                    <div className="text-sm text-white mt-1">
                      {build.completedAt
                        ? formatDate(build.completedAt)
                        : build.startedAt
                          ? formatDate(build.startedAt)
                          : 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Run History Section */}
              {(build.githubRunId ||
                (build.githubRunIdHistory?.length ?? 0) > 0) && (
                <div className="pt-4 border-t border-slate-800">
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
                    {build.githubRunIdHistory?.map((id) => (
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
            </div>
          )}

          {status !== 'success' && status !== 'failure' && (
            <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">
                Builds run in GitHub Actions. When the status is
                <span className="text-green-400 font-medium"> success</span>,
                your firmware artifact will be ready to download.
              </p>
            </div>
          )}

          {/* Build Configuration Summary */}
          {(excludedModules.length > 0 || enabledPlugins.length > 0) && (
            <div className="space-y-6 border-t border-slate-800 pt-6">
              {/* Excluded Modules */}
              {excludedModules.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Excluded Modules</h3>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
                    <div className="space-y-4">
                      {excludedModules.map((module) => (
                        <div
                          key={module.id}
                          className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0"
                        >
                          <h4 className="text-base font-medium mb-1">
                            {module.name}
                          </h4>
                          <p className="text-slate-400 text-sm">
                            {module.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Enabled Plugins */}
              {enabledPlugins.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Enabled Plugins</h3>
                  <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
                    <div className="space-y-4">
                      {enabledPlugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-medium">
                              {plugin.name}
                            </h4>
                            {plugin.version && (
                              <span className="text-xs text-slate-500">
                                v{plugin.version}
                              </span>
                            )}
                          </div>
                          {plugin.description && (
                            <p className="text-slate-400 text-sm">
                              {plugin.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'success' && build.buildHash && (
            <BuildDownloadButton
              build={build}
              type={ArtifactType.Firmware}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            />
          )}

          {build.buildHash && (
            <BuildDownloadButton
              build={build}
              type={ArtifactType.Source}
              variant="outline"
              className="w-full bg-slate-700 hover:bg-slate-600"
            />
          )}

          {status === 'failure' && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
              <p className="font-medium text-red-200">
                Build failed. Please try tweaking your configuration or
                re-running the build.
              </p>
            </div>
          )}

          {status !== 'success' && status !== 'failure' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-100">
              <p className="font-medium text-blue-200">
                This build is still running. Leave this tab open or come back
                later using the URL above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
