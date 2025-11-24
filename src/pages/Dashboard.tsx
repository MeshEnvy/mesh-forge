import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ProfileCardContent,
  profileCardClasses,
} from '@/components/ProfileCard'
import ProfileEditor from '@/components/ProfileEditor'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

export default function Dashboard() {
  const navigate = useNavigate()
  const profiles = useQuery(api.profiles.list)
  const removeProfile = useMutation(api.profiles.remove)
  const [isCreating, setIsCreating] = useState(false)

  const handleEdit = (profile: Doc<'profiles'>) => {
    navigate(`/dashboard/profiles/${profile._id}`)
  }

  const handleCreate = () => {
    setIsCreating(true)
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
        {isCreating ? (
          <ProfileEditor
            onSave={() => setIsCreating(false)}
            onCancel={() => setIsCreating(false)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profiles?.map((profile) => (
              <div key={profile._id} className={profileCardClasses}>
                <ProfileCardContent profile={profile} />
                <div className="flex gap-2 pt-2">
                  <Button size="sm" asChild>
                    <Link to={`/profiles/${profile._id}`}>Use</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(profile)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(profile._id, profile.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
