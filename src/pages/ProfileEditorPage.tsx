import { useQuery } from 'convex/react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ProfileEditor from '@/components/ProfileEditor'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export default function ProfileEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const profile = useQuery(
    api.profiles.get,
    id ? { id: id as Id<'profiles'> } : 'skip'
  )

  if (!id) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-300">
            No profile id provided.{' '}
            <Link to="/dashboard" className="text-cyan-400">
              Back to dashboard
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (profile === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Link>
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <p className="text-slate-300">Profile not found.</p>
          </div>
        </div>
      </div>
    )
  }

  const handleDone = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Link>
          <Button variant="outline" onClick={handleDone}>
            Cancel
          </Button>
        </div>

        <ProfileEditor
          initialData={profile}
          onSave={handleDone}
          onCancel={handleDone}
        />
      </div>
    </div>
  )
}
