import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import PARENT_MAP from '../constants/architecture-hierarchy.json'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: number | string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const msPerMinute = 60 * 1000
  const msPerHour = msPerMinute * 60
  const msPerDay = msPerHour * 24
  const msPerMonth = msPerDay * 30
  const msPerYear = msPerDay * 365

  const elapsed = now.getTime() - past.getTime()

  if (elapsed < msPerMinute) {
    return `${Math.round(elapsed / 1000)}s ago`
  } else if (elapsed < msPerHour) {
    return `${Math.round(elapsed / msPerMinute)}m ago`
  } else if (elapsed < msPerDay) {
    return `${Math.round(elapsed / msPerHour)}h ago`
  } else if (elapsed < msPerMonth) {
    return `${Math.round(elapsed / msPerDay)}d ago`
  } else if (elapsed < msPerYear) {
    return `${Math.round(elapsed / msPerMonth)}mo ago`
  } else {
    return `${Math.round(elapsed / msPerYear)}y ago`
  }
}

export function humanizeStatus(status: string): string {
  // Handle special statuses
  if (status === 'success') return 'Success'
  if (status === 'failure') return 'Failure'
  if (status === 'queued') return 'Queued'
  if (status === 'in_progress') return 'In Progress'

  // Convert snake_case/underscore_separated to Title Case
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Resolves plugin dependencies recursively from registry.
 * Returns all plugins that should be enabled (selected plugins + their dependencies).
 * Filters out "meshtastic" as it's a firmware version requirement, not a plugin.
 */
export function getDependedPlugins(
  selectedPlugins: string[],
  registry: Record<string, { dependencies?: Record<string, string> }>
): string[] {
  const result = new Set<string>()
  const visited = new Set<string>()

  function resolveDependencies(pluginId: string) {
    // Prevent circular dependencies
    if (visited.has(pluginId)) return
    visited.add(pluginId)

    const plugin = registry[pluginId]
    if (!plugin || !plugin.dependencies) return

    // Process each dependency
    for (const [depId] of Object.entries(plugin.dependencies)) {
      // Skip "meshtastic" - it's a firmware version requirement, not a plugin
      if (depId === 'meshtastic') continue

      // Only include dependencies that exist in the registry
      if (depId in registry) {
        result.add(depId)
        // Recursively resolve transitive dependencies
        resolveDependencies(depId)
      }
    }
  }

  // Start with selected plugins
  for (const pluginId of selectedPlugins) {
    if (pluginId in registry) {
      result.add(pluginId)
      resolveDependencies(pluginId)
    }
  }

  return Array.from(result)
}

/**
 * Gets only the implicit dependencies (dependencies that are not explicitly selected).
 * Returns a set of plugin IDs that are dependencies but not in the explicitly selected list.
 */
export function getImplicitDependencies(
  explicitlySelectedPlugins: string[],
  registry: Record<string, { dependencies?: Record<string, string> }>
): Set<string> {
  const allDependencies = getDependedPlugins(explicitlySelectedPlugins, registry)
  const explicitSet = new Set(explicitlySelectedPlugins)
  return new Set(allDependencies.filter((id) => !explicitSet.has(id)))
}

/**
 * Checks if a plugin is required by any other explicitly selected plugin.
 * Returns true if the plugin is a dependency (direct or transitive) of at least one explicitly selected plugin.
 */
export function isRequiredByOther(
  pluginId: string,
  explicitlySelectedPlugins: string[],
  registry: Record<string, { dependencies?: Record<string, string> }>
): boolean {
  // Check if any explicitly selected plugin depends on this plugin
  for (const selectedId of explicitlySelectedPlugins) {
    if (selectedId === pluginId) continue // Skip self
    
    // Get all dependencies (including transitive) of this selected plugin
    const allDeps = getDependedPlugins([selectedId], registry)
    if (allDeps.includes(pluginId)) {
      return true
    }
  }
  
  return false
}

/**
 * Normalize architecture name (remove hyphens and underscores to match PlatformIO format)
 * PlatformIO uses "esp32s3", "nrf52840" (no hyphens, no underscores)
 * Hardware list uses "esp32-s3" (with hyphens)
 * Some sources might use "esp32_s3" (with underscores)
 */
function normalizeArchitecture(arch: string): string {
  return arch.replace(/[-_]/g, '')
}

/**
 * Trace a target/variant/architecture back to its base architecture
 * Follows the parent chain until it reaches a base architecture (null parent)
 */
export function getBaseArchitecture(name: string): string | null {
  const normalized = normalizeArchitecture(name)
  const parentMap = PARENT_MAP as Record<string, string | null>
  
  const visited = new Set<string>()
  let current = normalized
  
  while (current && !visited.has(current)) {
    visited.add(current)
    const parent = parentMap[current]
    
    // If parent is null, we've reached a base architecture
    if (parent === null) {
      return current
    }
    
    // If no parent found, return current (might be unknown)
    if (parent === undefined) {
      return current
    }
    
    current = normalizeArchitecture(parent)
  }
  
  // Circular reference or unknown, return the last known
  return current || normalized
}

/**
 * Get all compatible architectures for a given architecture
 * (including itself and all parent architectures up to base)
 */
export function getCompatibleArchitectures(arch: string): string[] {
  const normalized = normalizeArchitecture(arch)
  const parentMap = PARENT_MAP as Record<string, string | null>
  
  const compatible = [normalized]
  const visited = new Set<string>()
  let current = normalized
  
  // Follow parent chain up to base architecture
  while (current && !visited.has(current)) {
    visited.add(current)
    const parent = parentMap[current]
    
    if (parent === null) {
      // Reached base architecture
      break
    }
    
    if (parent === undefined) {
      // Unknown, stop here
      break
    }
    
    const normalizedParent = normalizeArchitecture(parent)
    if (!compatible.includes(normalizedParent)) {
      compatible.push(normalizedParent)
    }
    
    current = normalizedParent
  }
  
  return compatible
}

/**
 * Check if a plugin is compatible with a target
 * Plugin can specify includes/excludes arrays with targets, variant bases, or architectures
 * 
 * @param pluginIncludes - Array of architectures/targets the plugin explicitly supports
 * @param pluginExcludes - Array of architectures/targets the plugin explicitly doesn't support
 * @param targetName - The target name to check compatibility against
 */
export function isPluginCompatibleWithTarget(
  pluginIncludes: string[] | undefined,
  pluginExcludes: string[] | undefined,
  targetName: string | undefined
): boolean {
  // If target not specified, can't determine compatibility
  if (!targetName) {
    return true // Default to compatible if unknown
  }

  const parentMap = PARENT_MAP as Record<string, string | null>
  
  // Normalize target name first (all keys in parentMap are normalized)
  const normalizedTarget = normalizeArchitecture(targetName)
  
  // Get all compatible names for the target (target itself + all parents up to base architecture)
  const compatibleNames = new Set<string>([normalizedTarget])
  const visited = new Set<string>()
  let current = normalizedTarget
  
  // Follow parent chain (all keys and values in parentMap are already normalized)
  while (current && !visited.has(current)) {
    visited.add(current)
    const parent = parentMap[current]
    
    if (parent === null) {
      // Reached base architecture
      compatibleNames.add(current) // Add the base architecture itself
      break
    }
    
    if (parent === undefined) {
      // Unknown, stop here
      break
    }
    
    // Parent is already normalized (from JSON)
    compatibleNames.add(parent)
    current = parent
  }
  
  // Check excludes first - if target matches any exclude, it's incompatible
  // compatibleNames are already normalized, normalize excludes for comparison
  if (pluginExcludes && pluginExcludes.length > 0) {
    const isExcluded = pluginExcludes.some((exclude) => {
      const normalizedExclude = normalizeArchitecture(exclude)
      return compatibleNames.has(normalizedExclude)
    })
    if (isExcluded) {
      return false
    }
  }
  
  // If includes are specified, target must match at least one include
  // compatibleNames are already normalized, normalize includes for comparison
  if (pluginIncludes && pluginIncludes.length > 0) {
    return pluginIncludes.some((include) => {
      const normalizedInclude = normalizeArchitecture(include)
      return compatibleNames.has(normalizedInclude)
    })
  }
  
  // If no includes/excludes specified, assume compatible with all (backward compatible)
  return true
}

/**
 * Check if a plugin is compatible with a target architecture
 * @deprecated Use isPluginCompatibleWithTarget instead
 */
export function isPluginCompatibleWithArchitecture(
  pluginArchitectures: string[] | undefined,
  targetArchitecture: string | undefined
): boolean {
  // Legacy support: treat architectures array as includes
  return isPluginCompatibleWithTarget(pluginArchitectures, undefined, targetArchitecture)
}
