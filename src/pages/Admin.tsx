import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BuildDownloadButton } from '@/components/BuildDownloadButton'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type FilterType = 'all' | 'failed'

export default function Admin() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('failed')
  const isAdmin = useQuery(api.admin.isAdmin)
  const failedBuilds = useQuery(api.admin.listFailedBuilds)
  const allBuilds = useQuery(api.admin.listAllBuilds)
  const retryBuild = useMutation(api.admin.retryBuild)

  const builds = filter === 'failed' ? failedBuilds : allBuilds

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
          <p className="text-slate-400 mb-4">
            You must be an admin to access this page.
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    )
  }

  const handleRetry = async (buildId: Id<'builds'>) => {
    try {
      await retryBuild({ buildId })
      toast.success('Build retry initiated', {
        description: 'The build has been queued with the latest YAML.',
      })
    } catch (error) {
      toast.error('Failed to retry build', {
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin - Builds</h1>
        <p className="text-slate-400 mb-4">
          View and manage builds. Retry failed builds with the latest GitHub
          Actions workflow YAML.
        </p>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
          >
            All Builds
          </Button>
          <Button
            variant={filter === 'failed' ? 'default' : 'outline'}
            onClick={() => setFilter('failed')}
            className={
              filter === 'failed' ? 'bg-cyan-600 hover:bg-cyan-700' : ''
            }
          >
            Failed Builds
          </Button>
        </div>
      </header>

      <main>
        {builds === undefined ? (
          <div className="text-center text-slate-400 py-12">
            Loading builds...
          </div>
        ) : builds.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            No {filter === 'failed' ? 'failed ' : ''}builds found.
          </div>
        ) : (
          <div className="space-y-4">
            {builds.map((build) => (
              <div
                key={build._id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold">
                        Build:{' '}
                        <Link
                          to={`/builds/${build.buildHash}`}
                          className="text-cyan-400 hover:text-cyan-300 underline"
                        >
                          {build.buildHash.substring(0, 8)}
                        </Link>
                      </h3>
                      {getStatusBadge(build.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-500">Target:</span>{' '}
                        <span className="font-mono">{build.config.target}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Version:</span>{' '}
                        <span className="font-mono">
                          {build.config.version}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">
                          {build.completedAt ? 'Completed' : 'Started'}:
                        </span>{' '}
                        {build.completedAt
                          ? formatDate(build.completedAt)
                          : build.startedAt
                            ? formatDate(build.startedAt)
                            : 'Unknown'}
                      </div>
                      <div>
                        <span className="text-slate-500">Run ID:</span>{' '}
                        {build.githubRunId ? (
                          <a
                            href={`https://github.com/MeshEnvy/configurable-web-flasher/actions/runs/${build.githubRunId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 underline"
                          >
                            {build.githubRunId}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </div>
                    </div>
                    {build.githubRunIdHistory &&
                      build.githubRunIdHistory.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          Previous runs:{' '}
                          {build.githubRunIdHistory.map((id, idx) => (
                            <span key={id}>
                              <a
                                href={`https://github.com/MeshEnvy/configurable-web-flasher/actions/runs/${id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 underline"
                              >
                                {id}
                              </a>
                              {idx <
                                (build.githubRunIdHistory?.length ?? 0) - 1 &&
                                ', '}
                            </span>
                          ))}
                        </div>
                      )}
                    {(build.artifactPath ||
                      build.sourceUrl ||
                      build.buildHash) && (
                      <div className="mt-3 flex gap-3">
                        {build.artifactPath && (
                          <BuildDownloadButton build={build} type="firmware" />
                        )}
                        {(build.sourceUrl || build.buildHash) && (
                          <BuildDownloadButton build={build} type="source" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <Button
                      onClick={() => handleRetry(build._id)}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      Re-run Build
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
