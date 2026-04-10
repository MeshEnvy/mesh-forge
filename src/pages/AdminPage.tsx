import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export default function AdminPage() {
  const isAdmin = useQuery(api.admin.isAdmin)
  const failedBuilds = useQuery(api.admin.listFailedRepoBuilds)
  const failedScans = useQuery(api.admin.listFailedRepoScans)
  const delBuild = useMutation(api.admin.deleteRepoBuild)
  const delScan = useMutation(api.admin.deleteFailedScan)

  if (isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-3">Access denied</h1>
          <p className="text-slate-400 mb-6">Admin only.</p>
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const removeBuild = async (id: Id<'repoBuilds'>) => {
    try {
      await delBuild({ buildId: id })
      toast.success('Build row deleted')
    } catch (e) {
      toast.error(String(e))
    }
  }

  const removeScan = async (id: Id<'repoRefScan'>) => {
    try {
      await delScan({ scanId: id })
      toast.success('Scan row deleted')
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-10 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-slate-400">
          Clear failed <code className="text-slate-300">repoBuilds</code> to allow a new dispatch for the same
          SHA+env. Clear failed <code className="text-slate-300">repoRefScan</code> to retry scanning a commit.
        </p>
      </header>

      <section className="mb-12 max-w-4xl">
        <h2 className="text-xl font-semibold mb-4">Failed builds</h2>
        {failedBuilds === undefined ? (
          <p className="text-slate-500">Loading…</p>
        ) : failedBuilds.length === 0 ? (
          <p className="text-slate-500">None.</p>
        ) : (
          <ul className="space-y-3">
            {failedBuilds.map(b => (
              <li
                key={b._id}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap gap-3 justify-between items-start"
              >
                <div className="text-sm space-y-1">
                  <div>
                    <Link className="text-cyan-400 hover:underline" to={`/${b.owner}/${b.repo}`}>
                      {b.owner}/{b.repo}
                    </Link>{' '}
                    <span className="text-slate-500">·</span> env{' '}
                    <code className="text-slate-300">{b.targetEnv}</code>
                  </div>
                  <div className="text-slate-500 font-mono text-xs">{b.buildKey}</div>
                  {b.githubRunId ? (
                    <a
                      className="text-cyan-500 text-xs hover:underline"
                      href={`https://github.com/MeshEnvy/mesh-forge/actions/runs/${b.githubRunId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Actions run #{b.githubRunId}
                    </a>
                  ) : null}
                  {b.errorSummary ? <p className="text-red-300 text-xs mt-2">{b.errorSummary}</p> : null}
                </div>
                <Button size="sm" variant="destructive" type="button" onClick={() => void removeBuild(b._id)}>
                  Delete row
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-4">Failed scans</h2>
        {failedScans === undefined ? (
          <p className="text-slate-500">Loading…</p>
        ) : failedScans.length === 0 ? (
          <p className="text-slate-500">None.</p>
        ) : (
          <ul className="space-y-3">
            {failedScans.map(s => (
              <li
                key={s._id}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap gap-3 justify-between items-start"
              >
                <div className="text-sm space-y-1">
                  <div>
                    <Link className="text-cyan-400 hover:underline" to={`/${s.owner}/${s.repo}`}>
                      {s.owner}/{s.repo}
                    </Link>
                  </div>
                  <div className="text-slate-500 font-mono text-xs">{s.resolvedSourceSha}</div>
                  {s.scanError ? <p className="text-red-300 text-xs mt-2">{s.scanError}</p> : null}
                </div>
                <Button size="sm" variant="destructive" type="button" onClick={() => void removeScan(s._id)}>
                  Delete row
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
