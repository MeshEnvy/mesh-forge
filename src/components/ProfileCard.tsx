import type { Doc } from '../../convex/_generated/dataModel'
import type { ProfileFields } from '../../convex/schema'

export const profileCardClasses =
  'border border-slate-800 rounded-lg p-6 bg-slate-900/50 flex flex-col gap-4'

interface ProfilePillsProps {
  version: string
  flashCount?: number
  flashLabel?: string
}

export function ProfileStatisticPills({
  version,
  flashCount,
  flashLabel,
}: ProfilePillsProps) {
  const normalizedCount = flashCount ?? 0
  const normalizedLabel =
    flashLabel ?? (normalizedCount === 1 ? 'flash' : 'flashes')
  return (
    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
      <span className="inline-flex items-center rounded-full bg-slate-800/80 text-slate-200 px-3 py-1">
        {version}
      </span>
      <span className="inline-flex items-center rounded-full bg-cyan-500/10 text-cyan-300 px-3 py-1">
        {normalizedCount} {normalizedLabel}
      </span>
    </div>
  )
}

interface ProfileCardContentProps {
  profile: Doc<'profiles'> & ProfileFields
}

export function ProfileCardContent({ profile }: ProfileCardContentProps) {
  const flashCount = profile.flashCount ?? 0
  return (
    <>
      <div className="flex-1">
        <h3 className="text-xl font-semibold mb-2">{profile.name}</h3>
        <p className="text-slate-300 text-sm leading-relaxed">
          {profile.description}
        </p>
      </div>
      <ProfileStatisticPills
        version={profile.version}
        flashCount={flashCount}
      />
    </>
  )
}
