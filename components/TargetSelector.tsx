import { TARGETS } from "@/constants/targets"

type TargetGroup = (typeof TARGETS)[string] & { id: string }

interface TargetSelectorProps {
  activeCategory: string
  categories: string[]
  groupedTargets: Record<string, TargetGroup[]>
  selectedTarget: string
  compatibleTargets: Set<string> | null
  onCategoryChange: (category: string) => void
  onTargetSelect: (targetId: string) => void
}

export function TargetSelector({
  activeCategory,
  categories,
  groupedTargets,
  selectedTarget,
  compatibleTargets,
  onCategoryChange,
  onTargetSelect,
}: TargetSelectorProps) {
  const targets = activeCategory ? groupedTargets[activeCategory] : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map(category => {
          const isActive = activeCategory === category
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {category}
            </button>
          )
        })}
      </div>

      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/60">
        <div className="flex flex-wrap gap-2">
          {targets?.map(target => {
            const isSelected = selectedTarget === target.id
            const normalizedId = target.id.replace(/[-_]/g, "")
            const isCompatible =
              !compatibleTargets || compatibleTargets.has(target.id) || compatibleTargets.has(normalizedId)

            return (
              <button
                key={target.id}
                type="button"
                onClick={() => isCompatible && onTargetSelect(target.id)}
                disabled={!isCompatible}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-cyan-600 text-white"
                    : isCompatible
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50"
                }`}
              >
                {target.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
