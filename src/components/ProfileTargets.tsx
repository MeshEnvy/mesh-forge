import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface ProfileTargetsProps {
  profileId: Id<'profiles'>
}

export default function ProfileTargets({ profileId }: ProfileTargetsProps) {
  const targets = useQuery(api.profiles.getTargets, { profileId })

  if (targets === undefined) {
    return <span className="text-slate-400 text-sm">Loading...</span>
  }

  if (targets.length === 0) {
    return <span className="text-slate-400 text-sm">No targets</span>
  }

  return (
    <span className="text-slate-400 text-sm">
      Targets: {targets.join(', ')}
    </span>
  )
}

