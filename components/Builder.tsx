import { BuildActions } from "@/components/BuildActions"
import { BuilderHeader } from "@/components/BuilderHeader"
import { ModuleConfig } from "@/components/ModuleConfig"
import { PluginConfig } from "@/components/PluginConfig"
import { TargetSelector } from "@/components/TargetSelector"
import { VersionSelector } from "@/components/VersionSelector"
import { TARGETS } from "@/constants/targets"
import { VERSIONS } from "@/constants/versions"
import { api } from "@/convex/_generated/api"
import { usePluginCompatibility } from "@/hooks/usePluginCompatibility"
import { useTargetSelection } from "@/hooks/useTargetSelection"
import { getDependedPlugins, getImplicitDependencies, isRequiredByOther } from "@/lib/utils"
import registryData from "@/public/registry.json"
import { useMutation, useQuery } from "convex/react"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { navigate } from "vike/client/router"

interface BuilderProps {
  cloneHash?: string
  pluginParam?: string
}

export default function Builder({ cloneHash, pluginParam }: BuilderProps) {
  const ensureBuildFromConfig = useMutation(api.builds.ensureBuildFromConfig)
  const pluginFlashCounts = useQuery(api.plugins.getAll) ?? {}
  const sharedBuild = useQuery(api.builds.getByHash, cloneHash ? { buildHash: cloneHash } : "skip")

  const preselectedPlugin =
    pluginParam && pluginParam in registryData
      ? (
          registryData as Record<
            string,
            { includes?: string[]; name: string; description: string; imageUrl?: string; featured?: boolean }
          >
        )[pluginParam]
      : null

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

  // Calculate plugin compatibility
  const { compatibleTargets, filteredGroupedTargets, filteredTargetCategories } = usePluginCompatibility(
    enabledPlugins,
    preselectedPlugin
  )

  // Target selection logic
  const { activeCategory, selectedTarget, setActiveCategory, handleSelectTarget, TARGET_CATEGORIES, GROUPED_TARGETS } =
    useTargetSelection(compatibleTargets, filteredGroupedTargets, filteredTargetCategories)

  // Preselect plugin from URL parameter
  useEffect(() => {
    if (pluginParam && preselectedPlugin && !cloneHash) {
      setPluginConfig({ [pluginParam]: true })
      setShowPlugins(true)
    }
  }, [pluginParam, preselectedPlugin, cloneHash])

  // Pre-populate form from shared build
  useEffect(() => {
    if (!cloneHash) return
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

    if (config.target && TARGETS[config.target]) {
      handleSelectTarget(config.target)
      const category = TARGETS[config.target].category || "Other"
      if (TARGET_CATEGORIES.includes(category)) {
        setActiveCategory(category)
      }
    }

    if (config.version && (VERSIONS as readonly string[]).includes(config.version)) {
      setSelectedVersion(config.version as (typeof VERSIONS)[number])
    }

    if (config.modulesExcluded) {
      setModuleConfig(config.modulesExcluded)
      if (Object.keys(config.modulesExcluded).length > 0) {
        setShowModuleOverrides(true)
      }
    }

    if (config.pluginsEnabled && config.pluginsEnabled.length > 0) {
      const allPluginSlugs = config.pluginsEnabled.map(pluginId => {
        return pluginId.includes("@") ? pluginId.split("@")[0] : pluginId
      })

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

      const pluginObj: Record<string, boolean> = {}
      allPluginSlugs.forEach(slug => {
        if (slug in registryData && !requiredByOthers.has(slug)) {
          pluginObj[slug] = true
        }
      })
      setPluginConfig(pluginObj)
      setShowPlugins(true)
    }
  }, [cloneHash, sharedBuild, handleSelectTarget, setActiveCategory, TARGET_CATEGORIES])

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
    const explicitPlugins = Object.keys(pluginConfig).filter(pluginId => pluginConfig[pluginId] === true)

    const implicitDeps = getImplicitDependencies(
      explicitPlugins,
      registryData as Record<string, { dependencies?: Record<string, string> }>
    )

    const isRequired = isRequiredByOther(
      id,
      explicitPlugins,
      registryData as Record<string, { dependencies?: Record<string, string> }>
    )

    if (implicitDeps.has(id)) {
      return
    }

    if (!enabled && isRequired) {
      return
    }

    setPluginConfig(prev => {
      const next = { ...prev }
      if (enabled) {
        next[id] = true
      } else {
        delete next[id]

        const remainingExplicit = Object.keys(next).filter(pluginId => next[pluginId] === true)
        const allStillNeeded = getDependedPlugins(
          remainingExplicit,
          registryData as Record<string, { dependencies?: Record<string, string> }>
        )

        for (const pluginId of Object.keys(next)) {
          if (next[pluginId] === true && !allStillNeeded.includes(pluginId) && !remainingExplicit.includes(pluginId)) {
            delete next[pluginId]
          }
        }

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
      navigate(`/builds?id=${result.buildHash}`)
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

  const categories = compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <BuilderHeader preselectedPlugin={preselectedPlugin} />

        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <TargetSelector
            activeCategory={activeCategory}
            categories={categories}
            groupedTargets={compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS}
            selectedTarget={selectedTarget}
            compatibleTargets={compatibleTargets}
            onCategoryChange={setActiveCategory}
            onTargetSelect={handleSelectTarget}
          />

          <VersionSelector selectedVersion={selectedVersion} onVersionChange={setSelectedVersion} />

          <ModuleConfig
            moduleConfig={moduleConfig}
            showModuleOverrides={showModuleOverrides}
            onToggleShow={() => setShowModuleOverrides(prev => !prev)}
            onToggleModule={handleToggleModule}
            onReset={() => setModuleConfig({})}
          />

          <PluginConfig
            pluginConfig={pluginConfig}
            selectedTarget={selectedTarget}
            pluginParam={pluginParam}
            pluginFlashCounts={pluginFlashCounts}
            showPlugins={showPlugins}
            onToggleShow={() => setShowPlugins(prev => !prev)}
            onTogglePlugin={handleTogglePlugin}
            onReset={() => setPluginConfig({})}
          />

          <BuildActions
            selectedTargetLabel={selectedTargetLabel}
            isFlashing={isFlashing}
            isFlashDisabled={!selectedTarget || isFlashing}
            errorMessage={errorMessage}
            onFlash={handleFlash}
          />
        </div>
      </div>
    </div>
  )
}
