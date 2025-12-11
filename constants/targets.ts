import architectureHierarchy from "@/constants/architecture-hierarchy.json"
import vendorsData from "@/constants/vendors.json"

export interface TargetMetadata {
  name: string
  category: string
  architecture?: string
}

/**
 * Trace a target back to its base architecture
 */
function getBaseArchitecture(target: string): string | null {
  const parentMap = architectureHierarchy as Record<string, string | null>
  const visited = new Set<string>()
  let current: string | null = target

  while (current && !visited.has(current)) {
    visited.add(current)
    if (!current) break
    const parent: string | null | undefined = parentMap[current]

    if (parent === null) {
      return current
    }

    if (parent === undefined) {
      return current
    }

    current = parent
  }

  return current || target
}

export const TARGETS: Record<string, TargetMetadata> = {}

// Build TARGETS from vendors.json and architecture-hierarchy.json
for (const [vendor, models] of Object.entries(vendorsData)) {
  for (const [modelName, target] of Object.entries(models)) {
    const architecture = getBaseArchitecture(target)
    TARGETS[target] = {
      name: modelName,
      category: vendor,
      architecture: architecture || undefined,
    }
  }
}
