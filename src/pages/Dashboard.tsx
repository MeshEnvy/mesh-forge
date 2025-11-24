import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import BuildsPanel from '@/components/BuildsPanel'
import ProfileEditor from '@/components/ProfileEditor'
import ProfileTargets from '@/components/ProfileTargets'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

export default function Dashboard() {
  const profiles = useQuery(api.profiles.list)
  const triggerBuild = useMutation(api.builds.triggerBuild)
  const removeProfile = useMutation(api.profiles.remove)
  const [isEditing, setIsEditing] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Doc<'profiles'> | null>(
    null
  )

  const handleEdit = (profile: Doc<'profiles'>) => {
    setEditingProfile(profile)
    setIsEditing(true)
  }

  const handleCreate = () => {
    setEditingProfile(null)
    setIsEditing(true)
  }

  const handleBuild = async (profileId: Id<'profiles'>) => {
    try {
      await triggerBuild({ profileId })
      toast.success('Build started', {
        description: 'Check the build status below.',
      })
    } catch (error) {
      toast.error('Build failed', {
        description: String(error),
      })
    }
  }

  const handleDelete = async (
    profileId: Id<'profiles'>,
    profileName: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete "${profileName}"? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      await removeProfile({ id: profileId })
      toast.success('Profile deleted', {
        description: `"${profileName}" has been deleted successfully.`,
      })
    } catch (error) {
      toast.error('Delete failed', {
        description: String(error),
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">My Fleet</h1>
        <Button
          onClick={handleCreate}
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          <Plus className="w-4 h-4 mr-2" /> New Profile
        </Button>
      </header>

      <main>
        {isEditing ? (
          <ProfileEditor
            initialData={editingProfile}
            onSave={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles?.map((profile) => (
              <div
                key={profile._id}
                className="border border-slate-800 rounded-lg p-6 bg-slate-900/50"
              >
                <h3 className="text-xl font-semibold mb-2">{profile.name}</h3>
                <p className="text-slate-400 text-sm mb-1">
                  Version:{' '}
                  <span className="text-slate-200">{profile.version}</span>
                </p>
                <p className="text-slate-400 text-sm mb-4">
                  <ProfileTargets profileId={profile._id} />
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(profile)}
                  >
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => handleBuild(profile._id)}>
                    Build
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(profile._id, profile.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800">
                  <BuildsPanel profileId={profile._id} />
                </div>
              </div>
            ))}
            {profiles?.length === 0 && (
              <div className="col-span-3 text-center text-slate-500 py-12">
                No profiles found. Create one to get started.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
