import { PluginCard } from "@/components/PluginCard"
import {
  getDependedPlugins,
  getImplicitDependencies,
  isPluginCompatibleWithTarget,
  isRequiredByOther,
} from "@/lib/utils"
import registryData from "@/public/registry.json"
import { ChevronDown, ChevronRight } from "lucide-react"

interface PluginConfigProps {
  pluginConfig: Record<string, boolean>
  selectedTarget: string
  pluginParam?: string
  pluginFlashCounts: Record<string, number>
  showPlugins: boolean
  onToggleShow: () => void
  onTogglePlugin: (id: string, enabled: boolean) => void
  onReset: () => void
}

export function PluginConfig({
  pluginConfig,
  selectedTarget,
  pluginParam,
  pluginFlashCounts,
  showPlugins,
  onToggleShow,
  onTogglePlugin,
  onReset,
}: PluginConfigProps) {
  const pluginCount = Object.keys(pluginConfig).filter(id => pluginConfig[id] === true).length

  // Get explicitly selected plugins (user-selected)
  const explicitPlugins = Object.keys(pluginConfig).filter(id => pluginConfig[id] === true)

  // Compute implicit dependencies (dependencies that are not explicitly selected)
  const implicitDeps = getImplicitDependencies(
    explicitPlugins,
    registryData as Record<string, { dependencies?: Record<string, string> }>
  )

  // Compute all enabled plugins (explicit + implicit)
  const allEnabledPlugins = getDependedPlugins(
    explicitPlugins,
    registryData as Record<string, { dependencies?: Record<string, string> }>
  )

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
      <button type="button" onClick={onToggleShow} className="w-full flex items-center justify-between text-left">
        <div>
          <p className="text-sm font-medium">Plugins</p>
          <p className="text-xs text-slate-400">
            {pluginCount === 0
              ? "No plugins enabled."
              : `${pluginCount} plugin${pluginCount === 1 ? "" : "s"} enabled.`}
          </p>
        </div>
        {showPlugins ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {showPlugins && (
        <div className="space-y-2 pr-1">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Plugins are 3rd party add-ons. They are not maintained, endorsed, or supported by Meshtastic. Use at your
              own risk.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-white underline"
              onClick={onReset}
              disabled={pluginCount === 0}
            >
              Reset plugins
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2" key={`plugins-${selectedTarget}`}>
            {Object.entries(registryData)
              .sort(([, pluginA], [, pluginB]) => {
                // Featured plugins first
                const featuredA = pluginA.featured ?? false
                const featuredB = pluginB.featured ?? false
                if (featuredA !== featuredB) {
                  return featuredA ? -1 : 1
                }
                // Then alphabetical by name
                return pluginA.name.localeCompare(pluginB.name)
              })
              .map(([slug, plugin]) => {
                // Check if plugin is required by another explicitly selected plugin
                const isRequired = isRequiredByOther(
                  slug,
                  explicitPlugins,
                  registryData as Record<string, { dependencies?: Record<string, string> }>
                )
                // Plugin is implicit if it's either:
                // 1. Not explicitly selected but is a dependency, OR
                // 2. Explicitly selected but required by another explicitly selected plugin
                const isImplicit = implicitDeps.has(slug) || (explicitPlugins.includes(slug) && isRequired)

                // Check plugin compatibility with selected target
                const pluginIncludes = (plugin as { includes?: string[] }).includes
                const pluginExcludes = (plugin as { excludes?: string[] }).excludes
                // Legacy support: check for old "architectures" field
                const legacyArchitectures = (plugin as { architectures?: string[] }).architectures
                const hasCompatibilityConstraints =
                  (pluginIncludes && pluginIncludes.length > 0) ||
                  (pluginExcludes && pluginExcludes.length > 0) ||
                  (legacyArchitectures && legacyArchitectures.length > 0)
                const isCompatible =
                  hasCompatibilityConstraints && selectedTarget
                    ? isPluginCompatibleWithTarget(
                        pluginIncludes || legacyArchitectures,
                        pluginExcludes,
                        selectedTarget
                      )
                    : true // If no constraints or no target selected, assume compatible
                // Mark as incompatible if plugin has compatibility constraints and target is not compatible
                const isIncompatible = !isCompatible && hasCompatibilityConstraints && !!selectedTarget

                // Check if this is the preselected plugin from URL
                const isPreselected = pluginParam === slug

                return (
                  <PluginCard
                    key={`${slug}-${selectedTarget}`}
                    variant="link-toggle"
                    id={slug}
                    name={plugin.name}
                    description={plugin.description}
                    imageUrl={plugin.imageUrl}
                    isEnabled={allEnabledPlugins.includes(slug)}
                    onToggle={enabled => onTogglePlugin(slug, enabled)}
                    disabled={isImplicit || isIncompatible || isPreselected}
                    enabledLabel={isPreselected ? "Locked" : isImplicit ? "Required" : "Add"}
                    incompatibleReason={isIncompatible ? "Not compatible with this target" : undefined}
                    featured={plugin.featured ?? false}
                    flashCount={pluginFlashCounts[slug] ?? 0}
                    homepage={plugin.homepage}
                    version={plugin.version}
                    repo={plugin.repo}
                  />
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
