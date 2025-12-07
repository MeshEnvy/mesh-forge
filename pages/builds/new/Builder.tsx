import { ModuleToggle } from "@/components/ModuleToggle"
import { PluginCard } from "@/components/PluginCard"
import { Button } from "@/components/ui/button"
import { TARGETS } from "@/constants/targets"
import { VERSIONS } from "@/constants/versions"
import { api } from "@/convex/_generated/api"
import modulesData from "@/convex/modules.json"
import {
  getDependedPlugins,
  getImplicitDependencies,
  getTargetsCompatibleWithIncludes,
  isPluginCompatibleWithTarget,
  isRequiredByOther,
} from "@/lib/utils"
import registryData from "@/public/registry.json"
import { useMutation, useQuery } from "convex/react"
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { usePageContext } from "vike-react/usePageContext"
import { navigate } from "vike/client/router"

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

const TARGET_CATEGORIES = Object.keys(GROUPED_TARGETS).sort((a, b) => a.localeCompare(b))

const DEFAULT_TARGET =
  TARGET_CATEGORIES.length > 0 && GROUPED_TARGETS[TARGET_CATEGORIES[0]]?.length
    ? GROUPED_TARGETS[TARGET_CATEGORIES[0]][0].id
    : ""

export default function BuildNew() {
  const pageContext = usePageContext()
  const buildHashParam = pageContext.routeParams?.buildHash
  const ensureBuildFromConfig = useMutation(api.builds.ensureBuildFromConfig)
  const pluginFlashCounts = useQuery(api.plugins.getAll) ?? {}
  const sharedBuild = useQuery(api.builds.getByHash, buildHashParam ? { buildHash: buildHashParam } : "skip")

  // Get plugin from URL query parameter
  const pluginParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("plugin") : null
  const preselectedPlugin =
    pluginParam && pluginParam in registryData
      ? (
          registryData as Record<
            string,
            { includes?: string[]; name: string; description: string; imageUrl?: string; featured?: boolean }
          >
        )[pluginParam]
      : null

  const STORAGE_KEY = "quick_build_target"
  const getStorageKeyForCategory = (category: string) => `quick_build_target_${category}`

  const persistTargetSelection = (targetId: string, category?: string) => {
    if (typeof window === "undefined") return
    try {
      // Store global most recent selection
      window.localStorage.setItem(STORAGE_KEY, targetId)
      // Store per-brand selection if category provided
      if (category) {
        window.localStorage.setItem(getStorageKeyForCategory(category), targetId)
      }
    } catch (error) {
      console.error("Failed to persist target selection", error)
    }
  }

  const getSavedTargetForCategory = (category: string): string | null => {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(getStorageKeyForCategory(category))
    } catch (error) {
      console.error("Failed to read saved target for category", error)
      return null
    }
  }

  const [activeCategory, setActiveCategory] = useState<string>(TARGET_CATEGORIES[0] ?? "")
  const [selectedTarget, setSelectedTarget] = useState<string>(DEFAULT_TARGET)
  const [selectedVersion, setSelectedVersion] = useState<string>(VERSIONS[0])
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({})
  const [pluginConfig, setPluginConfig] = useState<Record<string, boolean>>({})
  const [isFlashing, setIsFlashing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showModuleOverrides, setShowModuleOverrides] = useState(false)
  const [showPlugins, setShowPlugins] = useState(true)
  const [isLoadingSharedBuild, setIsLoadingSharedBuild] = useState(false)

  // Get all enabled plugins
  const enabledPlugins = Object.keys(pluginConfig).filter(id => pluginConfig[id] === true)

  // Filter targets based on plugin compatibility
  // Start with preselected plugin compatibility if present
  let compatibleTargets: Set<string> | null = preselectedPlugin?.includes
    ? getTargetsCompatibleWithIncludes(preselectedPlugin.includes)
    : null

  // Intersect with compatibility of all enabled plugins
  if (enabledPlugins.length > 0) {
    const pluginRegistry = registryData as Record<string, { includes?: string[] }>
    const allCompatibleSets: Set<string>[] = []

    // Get compatible targets for each enabled plugin
    for (const pluginId of enabledPlugins) {
      const plugin = pluginRegistry[pluginId]
      if (plugin?.includes && plugin.includes.length > 0) {
        // Plugin has includes - get compatible targets
        allCompatibleSets.push(getTargetsCompatibleWithIncludes(plugin.includes))
      }
      // If plugin has no includes, it's compatible with all targets (don't add to set)
    }

    // If we have compatible sets, find intersection
    if (allCompatibleSets.length > 0) {
      if (compatibleTargets) {
        // Intersect with preselected plugin compatibility
        compatibleTargets = new Set(
          Array.from(compatibleTargets).filter(target => allCompatibleSets.every(set => set.has(target)))
        )
      } else {
        // Start with first set, then intersect with others
        compatibleTargets = allCompatibleSets[0]
        for (let i = 1; i < allCompatibleSets.length; i++) {
          compatibleTargets = new Set(Array.from(compatibleTargets).filter(target => allCompatibleSets[i].has(target)))
        }
      }
    } else if (!compatibleTargets) {
      // No enabled plugins have includes, so all targets are compatible
      // (only if there's no preselected plugin with includes)
      compatibleTargets = null
    }
  }

  const filteredGroupedTargets = compatibleTargets
    ? Object.entries(GROUPED_TARGETS).reduce(
        (acc, [category, targets]) => {
          const filtered = targets.filter(target => {
            // Check both normalized and original target ID
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

  // Preselect plugin from URL parameter
  useEffect(() => {
    if (pluginParam && preselectedPlugin && !buildHashParam) {
      setPluginConfig({ [pluginParam]: true })
      setShowPlugins(true)
    }
  }, [pluginParam, preselectedPlugin, buildHashParam])

  useEffect(() => {
    const categories = compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0])
    }
  }, [activeCategory, compatibleTargets, filteredTargetCategories])

  useEffect(() => {
    if (activeCategory) {
      const targets = compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS
      const categoryTargets = targets[activeCategory] || []

      if (categoryTargets.length === 0) return

      // Check if current selected target is in this category
      const isCurrentTargetInCategory = categoryTargets.some(t => t.id === selectedTarget)

      if (!isCurrentTargetInCategory) {
        // Try to restore per-brand selection
        const savedTargetForCategory = getSavedTargetForCategory(activeCategory)
        const isValidSavedTarget = savedTargetForCategory && categoryTargets.some(t => t.id === savedTargetForCategory)

        if (isValidSavedTarget) {
          setSelectedTarget(savedTargetForCategory)
          // Persist the restored selection
          persistTargetSelection(savedTargetForCategory, activeCategory)
        } else {
          // Default to first target in category and persist it
          const firstTarget = categoryTargets[0].id
          setSelectedTarget(firstTarget)
          persistTargetSelection(firstTarget, activeCategory)
        }
      }
    }
  }, [activeCategory, compatibleTargets, filteredGroupedTargets, selectedTarget])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const targets = compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS
      const categories = compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES

      if (categories.length === 0) return

      // Try to restore the most recent global selection first
      const savedTarget = localStorage.getItem(STORAGE_KEY)
      if (savedTarget && TARGETS[savedTarget]) {
        // Check if saved target exists in filtered targets
        const isCompatible = Object.values(targets).some(categoryTargets =>
          categoryTargets.some(target => target.id === savedTarget)
        )

        if (isCompatible) {
          const category = TARGETS[savedTarget].category || "Other"
          if (categories.includes(category)) {
            setActiveCategory(category)
            setSelectedTarget(savedTarget)
            persistTargetSelection(savedTarget, category)
            return
          }
        }
      }

      // Fall back to per-brand selection for first category
      const firstCategory = categories[0]
      const categoryTargets = targets[firstCategory] || []

      if (categoryTargets.length > 0) {
        // Try to restore per-brand selection
        const savedTargetForCategory = getSavedTargetForCategory(firstCategory)
        const isValidSavedTarget = savedTargetForCategory && categoryTargets.some(t => t.id === savedTargetForCategory)

        if (isValidSavedTarget) {
          setActiveCategory(firstCategory)
          setSelectedTarget(savedTargetForCategory)
          persistTargetSelection(savedTargetForCategory, firstCategory)
        } else {
          // Default to first target in category
          const firstTarget = categoryTargets[0].id
          setActiveCategory(firstCategory)
          setSelectedTarget(firstTarget)
          persistTargetSelection(firstTarget, firstCategory)
        }
      }
    } catch (error) {
      console.error("Failed to read saved target", error)
    }
  }, [compatibleTargets, filteredGroupedTargets, filteredTargetCategories])

  const handleSelectTarget = (targetId: string) => {
    // Validate target is compatible with selected plugins
    if (compatibleTargets) {
      const normalizedId = targetId.replace(/[-_]/g, "")
      const isCompatible = compatibleTargets.has(targetId) || compatibleTargets.has(normalizedId)
      if (!isCompatible) {
        // Target is not compatible, don't allow selection
        return
      }
    }
    setSelectedTarget(targetId)
    const category = TARGETS[targetId]?.category || "Other"
    persistTargetSelection(targetId, category)
    if (category && TARGET_CATEGORIES.includes(category)) {
      setActiveCategory(category)
    }
  }

  // Update selected target if it becomes incompatible with selected plugins
  useEffect(() => {
    if (!selectedTarget || !compatibleTargets) return

    const normalizedId = selectedTarget.replace(/[-_]/g, "")
    const isCompatible = compatibleTargets.has(selectedTarget) || compatibleTargets.has(normalizedId)

    if (!isCompatible) {
      // Current target is no longer compatible, find a compatible one
      const targets = filteredGroupedTargets
      const categories = filteredTargetCategories

      if (categories.length > 0) {
        // Try to find a compatible target in the current category first
        const currentCategory = TARGETS[selectedTarget]?.category
        if (currentCategory && targets[currentCategory] && targets[currentCategory].length > 0) {
          const savedTargetForCategory = getSavedTargetForCategory(currentCategory)
          const isValidSavedTarget =
            savedTargetForCategory && targets[currentCategory].some(t => t.id === savedTargetForCategory)

          if (isValidSavedTarget) {
            setSelectedTarget(savedTargetForCategory)
            persistTargetSelection(savedTargetForCategory, currentCategory)
            return
          }

          // Default to first target in current category
          setSelectedTarget(targets[currentCategory][0].id)
          persistTargetSelection(targets[currentCategory][0].id, currentCategory)
          return
        }

        // Fall back to first compatible target
        const firstCategory = categories[0]
        const firstTarget = targets[firstCategory]?.[0]?.id
        if (firstTarget) {
          setSelectedTarget(firstTarget)
          setActiveCategory(firstCategory)
          persistTargetSelection(firstTarget, firstCategory)
        }
      }
    }
  }, [compatibleTargets, filteredGroupedTargets, filteredTargetCategories, selectedTarget])

  useEffect(() => {
    if (typeof window === "undefined" || !selectedTarget) return
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, selectedTarget)
      }
    } catch (error) {
      console.error("Failed to initialize target storage", error)
    }
  }, [selectedTarget])

  // Pre-populate form from shared build
  useEffect(() => {
    if (!buildHashParam) return
    if (sharedBuild === undefined) {
      setIsLoadingSharedBuild(true)
      return
    }
    setIsLoadingSharedBuild(false)

    if (!sharedBuild) {
      setErrorMessage("Build not found. The shared build may have been deleted.")
      toast.error("Build not found", {
        description: "The shared build could not be loaded.",
      })
      return
    }

    const config = sharedBuild.config

    // Set target and category
    if (config.target && TARGETS[config.target]) {
      setSelectedTarget(config.target)
      const category = TARGETS[config.target].category || "Other"
      if (TARGET_CATEGORIES.includes(category)) {
        setActiveCategory(category)
      }
    }

    // Set version
    if (config.version && (VERSIONS as readonly string[]).includes(config.version)) {
      setSelectedVersion(config.version as (typeof VERSIONS)[number])
    }

    // Set module config (already in the correct format)
    if (config.modulesExcluded) {
      setModuleConfig(config.modulesExcluded)
      if (Object.keys(config.modulesExcluded).length > 0) {
        setShowModuleOverrides(true)
      }
    }

    // Set plugin config (convert array to object format)
    // Only add explicitly selected plugins, not implicit dependencies
    if (config.pluginsEnabled && config.pluginsEnabled.length > 0) {
      const allPluginSlugs = config.pluginsEnabled.map(pluginId => {
        return pluginId.includes("@") ? pluginId.split("@")[0] : pluginId
      })

      // Determine which plugins are required by others (implicit dependencies)
      const requiredByOthers = new Set<string>()
      for (const pluginSlug of allPluginSlugs) {
        if (
          isRequiredByOther(
            pluginSlug,
            allPluginSlugs,
            registryData as Record<string, { dependencies?: Record<string, string> }>
          )
        ) {
          requiredByOthers.add(pluginSlug)
        }
      }

      // Only add plugins that are NOT required by others (explicitly selected)
      const pluginObj: Record<string, boolean> = {}
      allPluginSlugs.forEach(slug => {
        if (slug in registryData && !requiredByOthers.has(slug)) {
          pluginObj[slug] = true
        }
      })
      setPluginConfig(pluginObj)
      setShowPlugins(true)
    }
  }, [buildHashParam, sharedBuild])

  const moduleCount = Object.keys(moduleConfig).length
  const pluginCount = Object.keys(pluginConfig).filter(id => pluginConfig[id] === true).length
  const selectedTargetLabel = (selectedTarget && TARGETS[selectedTarget]?.name) || selectedTarget

  const handleToggleModule = (id: string, excluded: boolean) => {
    setModuleConfig(prev => {
      const next = { ...prev }
      if (excluded) {
        next[id] = true
      } else {
        delete next[id]
      }
      return next
    })
  }

  const handleTogglePlugin = (id: string, enabled: boolean) => {
    // Get current explicit selections
    const explicitPlugins = Object.keys(pluginConfig).filter(pluginId => pluginConfig[pluginId] === true)

    // Check if this plugin is currently an implicit dependency
    const implicitDeps = getImplicitDependencies(
      explicitPlugins,
      registryData as Record<string, { dependencies?: Record<string, string> }>
    )

    // Check if this plugin is required by another explicitly selected plugin
    const isRequired = isRequiredByOther(
      id,
      explicitPlugins,
      registryData as Record<string, { dependencies?: Record<string, string> }>
    )

    // Don't allow toggling implicit dependencies at all
    // (they should be disabled in the UI, but add this as a safeguard)
    if (implicitDeps.has(id)) {
      return // Can't toggle implicit dependencies
    }

    // Don't allow disabling if it's required by another explicitly selected plugin
    if (!enabled && isRequired) {
      return // Can't disable required plugins
    }

    setPluginConfig(prev => {
      const next = { ...prev }
      if (enabled) {
        // Enabling: add to explicit selection (even if it was implicit)
        next[id] = true
      } else {
        // Disabling: remove from explicit selection
        delete next[id]

        // Recompute what plugins are still needed after removal
        const remainingExplicit = Object.keys(next).filter(pluginId => next[pluginId] === true)
        const allStillNeeded = getDependedPlugins(
          remainingExplicit,
          registryData as Record<string, { dependencies?: Record<string, string> }>
        )

        // Remove any plugins from config that are no longer needed
        // BUT preserve all plugins that are currently explicitly selected (in remainingExplicit)
        // This ensures that plugins that were explicitly selected remain explicitly selected
        // even if they temporarily became implicit and then un-implicit
        for (const pluginId of Object.keys(next)) {
          if (next[pluginId] === true && !allStillNeeded.includes(pluginId) && !remainingExplicit.includes(pluginId)) {
            // This plugin is no longer needed and is not in the remaining explicit list
            // Only remove if it's truly not needed and wasn't explicitly selected
            // Note: If a plugin is in `next` with value `true`, it should be in `remainingExplicit`
            // So this condition should rarely be true, but we keep it as a safety check
            delete next[pluginId]
          }
        }

        // Ensure all remaining explicitly selected plugins stay in config
        // (they should already be there, but this ensures they remain even if they're not needed)
        for (const pluginId of remainingExplicit) {
          next[pluginId] = true
        }
      }
      return next
    })
  }

  const handleFlash = async () => {
    if (!selectedTarget) return
    setIsFlashing(true)
    setErrorMessage(null)
    try {
      const enabledSlugs = Object.keys(pluginConfig).filter(id => pluginConfig[id] === true)

      // Double-check: filter out any implicit dependencies that might have snuck in
      // This ensures we only send explicitly selected plugins to the backend
      const implicitDeps = getImplicitDependencies(
        enabledSlugs,
        registryData as Record<string, { dependencies?: Record<string, string> }>
      )
      const explicitOnlySlugs = enabledSlugs.filter(slug => !implicitDeps.has(slug))

      const pluginsEnabled = explicitOnlySlugs.map(slug => {
        const plugin = (registryData as Record<string, { version: string }>)[slug]
        return `${slug}@${plugin.version}`
      })
      const result = await ensureBuildFromConfig({
        target: selectedTarget,
        version: selectedVersion,
        modulesExcluded: moduleConfig,
        pluginsEnabled: pluginsEnabled.length > 0 ? pluginsEnabled : undefined,
      })
      navigate(`/builds/${result.buildHash}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorMessage("Failed to start build. Please try again.")
      toast.error("Failed to start build", {
        description: message,
      })
    } finally {
      setIsFlashing(false)
    }
  }

  const isFlashDisabled = !selectedTarget || isFlashing

  if (isLoadingSharedBuild) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
          <p className="text-slate-400">Loading shared build configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500">
              {preselectedPlugin ? "Plugin build" : "Quick build"}
            </p>
            <h1 className="text-4xl font-bold mt-1">
              {preselectedPlugin ? `Build firmware for ${preselectedPlugin.name}` : "Flash a custom firmware version"}
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              {preselectedPlugin
                ? `Select a compatible Meshtastic target and configure your build for ${preselectedPlugin.name}. We'll send you to the build status page as soon as it starts.`
                : "Choose your Meshtastic target, adjust optional modules, and queue a new build instantly. We'll send you to the build status page as soon as it starts."}
            </p>
          </div>
        </div>

        {preselectedPlugin && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0 mt-1" />
              <div className="flex items-start gap-4 flex-1">
                {preselectedPlugin.imageUrl && (
                  <img
                    src={preselectedPlugin.imageUrl}
                    alt={`${preselectedPlugin.name} logo`}
                    className="w-16 h-16 rounded-lg object-contain shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{preselectedPlugin.name}</h2>
                    {preselectedPlugin.featured && (
                      <span className="px-2 py-1 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded">
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 mb-3">{preselectedPlugin.description}</p>
                  {preselectedPlugin.includes && preselectedPlugin.includes.length > 0 && (
                    <p className="text-sm text-slate-500">Compatible with: {preselectedPlugin.includes.join(", ")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES).map(category => {
                const isActive = activeCategory === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      // Always allow switching to category - the useEffect will handle target selection
                      setActiveCategory(category)
                    }}
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
                {(() => {
                  const targets = compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS
                  return (activeCategory ? targets[activeCategory] : [])?.map(target => {
                    const isSelected = selectedTarget === target.id
                    return (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => handleSelectTarget(target.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          isSelected ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {target.name}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="build-version" className="block text-sm font-medium mb-2">
              Firmware version
            </label>
            <select
              id="build-version"
              value={selectedVersion}
              onChange={event => setSelectedVersion(event.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-800 bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {VERSIONS.map(version => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <button
              type="button"
              onClick={() => setShowModuleOverrides(prev => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium">Core Modules</p>
                <p className="text-xs text-slate-400">
                  {moduleCount === 0
                    ? "Using default modules for this target."
                    : `${moduleCount} module${moduleCount === 1 ? "" : "s"} excluded.`}
                </p>
              </div>
              {showModuleOverrides ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showModuleOverrides && (
              <div className="space-y-2 pr-1">
                <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Core Modules are officially maintained modules by Meshtastic. They are selectively included or
                    excluded by default depending on the target device. You can explicitly exclude modules you know you
                    don't want.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white underline"
                    onClick={() => setModuleConfig({})}
                    disabled={moduleCount === 0}
                  >
                    Reset overrides
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {modulesData.modules.map(module => (
                    <ModuleToggle
                      key={module.id}
                      id={module.id}
                      name={module.name}
                      description={module.description}
                      isExcluded={moduleConfig[module.id] === true}
                      onToggle={excluded => handleToggleModule(module.id, excluded)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <button
              type="button"
              onClick={() => setShowPlugins(prev => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
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
                    Plugins are 3rd party add-ons. They are not maintained, endorsed, or supported by Meshtastic. Use at
                    your own risk.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white underline"
                    onClick={() => setPluginConfig({})}
                    disabled={pluginCount === 0}
                  >
                    Reset plugins
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2" key={`plugins-${selectedTarget}`}>
                  {(() => {
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

                    return Object.entries(registryData)
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
                            onToggle={enabled => handleTogglePlugin(slug, enabled)}
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
                      })
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button onClick={handleFlash} disabled={isFlashDisabled} className="w-full bg-cyan-600 hover:bg-cyan-700">
              {isFlashing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Queuing build...
                </span>
              ) : (
                `Flash ${selectedTargetLabel || ""}`.trim() || "Flash"
              )}
            </Button>
            {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
