import { TARGETS } from "@/constants/targets"
import { getTargetsCompatibleWithIncludes } from "@/lib/utils"
import registryData from "@/public/registry.json"

type TargetGroup = (typeof TARGETS)[string] & { id: string }

const GROUPED_TARGETS = Object.entries(TARGETS).reduce(
  (acc, [id, meta]) => {
    const category = meta.category || "Other"
    if (!acc[category]) acc[category] = []
    acc[category].push({ id, ...meta })
    return acc
  },
  {} as Record<string, TargetGroup[]>
)

export function usePluginCompatibility(enabledPlugins: string[], preselectedPlugin?: { includes?: string[] } | null) {
  // Start with preselected plugin compatibility if present
  let compatibleTargets: Set<string> | null = preselectedPlugin?.includes
    ? getTargetsCompatibleWithIncludes(preselectedPlugin.includes)
    : null

  // Intersect with compatibility of all enabled plugins
  if (enabledPlugins.length > 0) {
    const pluginRegistry = registryData as Record<string, { includes?: string[] }>
    const allCompatibleSets: Set<string>[] = []

    for (const pluginId of enabledPlugins) {
      const plugin = pluginRegistry[pluginId]
      if (plugin?.includes && plugin.includes.length > 0) {
        allCompatibleSets.push(getTargetsCompatibleWithIncludes(plugin.includes))
      }
    }

    if (allCompatibleSets.length > 0) {
      if (compatibleTargets) {
        compatibleTargets = new Set(
          Array.from(compatibleTargets).filter(target => allCompatibleSets.every(set => set.has(target)))
        )
      } else {
        compatibleTargets = allCompatibleSets[0]
        for (let i = 1; i < allCompatibleSets.length; i++) {
          compatibleTargets = new Set(Array.from(compatibleTargets).filter(target => allCompatibleSets[i].has(target)))
        }
      }
    } else if (!compatibleTargets) {
      compatibleTargets = null
    }
  }

  const filteredGroupedTargets = compatibleTargets
    ? Object.entries(GROUPED_TARGETS).reduce(
        (acc, [category, targets]) => {
          const filtered = targets.filter(target => {
            const normalizedId = target.id.replace(/[-_]/g, "")
            return compatibleTargets.has(target.id) || compatibleTargets.has(normalizedId)
          })
          if (filtered.length > 0) {
            acc[category] = filtered
          }
          return acc
        },
        {} as Record<string, TargetGroup[]>
      )
    : GROUPED_TARGETS

  const filteredTargetCategories = Object.keys(filteredGroupedTargets).sort((a, b) => a.localeCompare(b))

  return {
    compatibleTargets,
    filteredGroupedTargets,
    filteredTargetCategories,
  }
}
