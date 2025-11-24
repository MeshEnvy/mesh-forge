import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Loader2,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ProfileStatisticPills } from '@/components/ProfileCard'
import { Button } from '@/components/ui/button'
import { humanizeStatus } from '@/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import modulesData from '../../convex/modules.json'
import { TARGETS } from '../constants/targets'

export default function ProfileFlash() {
  const { id, target } = useParams<{
    id: string
    target: string
  }>()

  const data = useQuery(
    api.profiles.getProfileTarget,
    id && target ? { profileId: id as Id<'profiles'>, target } : 'skip'
  )
  const profile = useQuery(
    api.profiles.get,
    id ? { id: id as Id<'profiles'> } : 'skip'
  )
  const recordFlash = useMutation(api.profiles.recordFlash)

  if (data === undefined || profile === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (data === null || !data.build) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to={`/profiles/${id}`}
            className="inline-flex items-center text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
          </Link>
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <p className="text-slate-400">Build not found</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to={`/profiles/${id}`}
            className="inline-flex items-center text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
          </Link>
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <p className="text-slate-400">Profile not found</p>
          </div>
        </div>
      </div>
    )
  }

  const build = data.build
  const targetMeta = target ? TARGETS[target] : undefined
  const targetLabel = targetMeta?.name ?? target ?? 'Unknown Target'
  const includedModules = modulesData.modules.filter(
    (module) => profile.config?.[module.id] === false
  )
  const totalFlashes = profile.flashCount ?? 0

  const handleDownload = async () => {
    if (!id || !build.artifactUrl) return

    try {
      await recordFlash({ profileId: id as Id<'profiles'> })
    } catch (error) {
      console.error('Failed to record flash', error)
    } finally {
      window.open(build.artifactUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'text-green-400'
    if (status === 'failure') return 'text-red-400'
    return 'text-blue-400'
  }

  const getStatusIcon = (status: string) => {
    if (status === 'success') {
      return <CheckCircle className="w-6 h-6 text-green-500" />
    }
    if (status === 'failure') {
      return <XCircle className="w-6 h-6 text-red-500" />
    }
    return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
  }

  const githubActionUrl =
    build.githubRunId > 0
      ? `https://github.com/MeshEnvy/configurable-web-flasher/actions/runs/${build.githubRunId}`
      : null

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to={`/profiles/${id}`}
          className="inline-flex items-center text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Profile
        </Link>

        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 space-y-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">
              Profile
            </p>
            <h1 className="text-3xl font-bold mt-1">{profile.name}</h1>
            <p className="text-slate-400 text-sm mt-2">
              Version: <span className="text-slate-200">{profile.version}</span>
            </p>
          </div>
          <p className="text-slate-200 leading-relaxed">
            {profile.description}
          </p>
          <ProfileStatisticPills
            version={profile.version}
            flashCount={totalFlashes}
          />
        </div>

        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold mb-4">Included Modules</h2>
          {includedModules.length === 0 ? (
            <p className="text-slate-400 text-sm">No modules included.</p>
          ) : (
            <div className="space-y-3">
              {includedModules.map((module) => (
                <div key={module.id}>
                  <p className="font-medium text-sm">{module.name}</p>
                  <p className="text-slate-400 text-sm">{module.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-4">
            {getStatusIcon(build.status)}
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-500">
                Target
              </p>
              <h2 className="text-2xl font-semibold">{targetLabel}</h2>
              <div className="flex items-center gap-2 text-slate-400 mt-1 text-sm">
                <span className={getStatusColor(build.status)}>
                  {humanizeStatus(build.status)}
                </span>
                <span>•</span>
                <span>{new Date(build.startedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {githubActionUrl && (
            <div>
              <a
                href={githubActionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-cyan-400 hover:text-cyan-300 text-sm"
              >
                View on GitHub Actions
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </div>
          )}

          {build.status === 'success' && build.artifactUrl && (
            <div>
              <Button
                onClick={handleDownload}
                className="bg-cyan-600 hover:bg-cyan-700 w-full"
              >
                Download Firmware
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
