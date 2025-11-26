import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import * as React from 'react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ProfileStatisticPills } from '@/components/ProfileCard'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import modulesData from '../../convex/modules.json'
import { TARGETS } from '../constants/targets'

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useConvexAuth()
  const { signIn } = useAuthActions()
  const ensureBuildForProfileTarget = useMutation(
    api.builds.ensureBuildForProfileTarget
  )
  const profile = useQuery(
    api.profiles.get,
    id ? { id: id as Id<'profiles'> } : 'skip'
  )
  const [selectedTarget, setSelectedTarget] = useState<string>('')

  // Group targets by category
  const groupedTargets = React.useMemo(() => {
    return Object.entries(TARGETS).reduce(
      (acc, [targetId, meta]) => {
        const category = meta.category || 'Other'
        if (!acc[category]) acc[category] = []
        acc[category].push({ id: targetId, ...meta })
        return acc
      },
      {} as Record<string, ((typeof TARGETS)[string] & { id: string })[]>
    )
  }, [])

  const categories = React.useMemo(
    () => Object.keys(groupedTargets).sort(),
    [groupedTargets]
  )

  const [activeCategory, setActiveCategory] = React.useState<string>(
    categories[0] || ''
  )

  // Update active category when categories load if not set
  React.useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0])
    }
  }, [categories, activeCategory])

  // Load saved target
  React.useEffect(() => {
    if (!id) return
    const savedTarget = localStorage.getItem(`profile_target_${id}`)
    if (savedTarget && TARGETS[savedTarget]) {
      setSelectedTarget(savedTarget)
      const category = TARGETS[savedTarget].category || 'Other'
      if (categories.includes(category)) {
        setActiveCategory(category)
      }
    }
  }, [id, categories])

  // Save target on change
  React.useEffect(() => {
    if (!id || !selectedTarget) return
    localStorage.setItem(`profile_target_${id}`, selectedTarget)
  }, [id, selectedTarget])

  if (!id) {
    return <div>Profile ID required</div>
  }

  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (profile === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <div>Profile not found</div>
      </div>
    )
  }

  // Get excluded modules (new logic: config[id] === true means excluded)
  const excludedModules = modulesData.modules.filter(
    (module) => profile.config.modulesExcluded[module.id] === true
  )

  const handleFlash = async () => {
    if (!selectedTarget || !id) return

    if (!isAuthenticated) {
      void signIn('google', { redirectTo: window.location.href })
      return
    }

    try {
      await ensureBuildForProfileTarget({
        profileId: id as Id<'profiles'>,
        target: selectedTarget,
      })
      navigate(`/profiles/${id}/flash/${selectedTarget}`)
    } catch (error) {
      toast.error('Failed to start flash', {
        description: String(error),
      })
    }
  }

  const totalFlashes = profile.flashCount ?? 0

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">{profile.name}</h1>
            <p className="text-slate-400">
              Flashed {totalFlashes} time{totalFlashes !== 1 ? 's' : ''}
            </p>
          </div>
          <ProfileStatisticPills
            version={profile.version}
            flashCount={totalFlashes}
          />
        </div>

        <div className="space-y-8">
          {/* Excluded Modules */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Excluded Modules</h2>
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              {excludedModules.length === 0 ? (
                <p className="text-slate-400">
                  No modules explicitly excluded. All modules supported by your
                  target will be included.
                </p>
              ) : (
                <div className="space-y-4">
                  {excludedModules.map((module) => (
                    <div
                      key={module.id}
                      className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0"
                    >
                      <h3 className="text-lg font-medium mb-1">
                        {module.name}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        {module.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Target Selection and Flash */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Flash Firmware</h2>
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              <div className="space-y-4">
                <div>
                  <div className="block text-sm font-medium mb-2">
                    Select Target
                  </div>
                  <div className="space-y-4">
                    {/* Category Pills */}
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const isActive = activeCategory === category

                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setActiveCategory(category)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {category}
                          </button>
                        )
                      })}
                    </div>

                    {/* Active Category Targets */}
                    <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                      <div className="flex gap-2 flex-wrap">
                        {groupedTargets[activeCategory]?.map((item) => {
                          const isSelected = selectedTarget === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedTarget(item.id)}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {item.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleFlash}
                  disabled={!selectedTarget}
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                >
                  Flash
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
