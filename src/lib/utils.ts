import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
