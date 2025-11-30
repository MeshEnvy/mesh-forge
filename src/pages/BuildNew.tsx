import { useMutation, useQuery } from 'convex/react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ModuleToggle } from '@/components/ModuleToggle'
import { PluginToggle } from '@/components/PluginToggle'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import modulesData from '../../convex/modules.json'
import registryData from '../../registry/registry.json'
import { TARGETS } from '../constants/targets'
import { VERSIONS } from '../constants/versions'

type TargetGroup = (typeof TARGETS)[string] & { id: string }

const GROUPED_TARGETS = Object.entries(TARGETS).reduce(
  (acc, [id, meta]) => {
    const category = meta.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push({ id, ...meta })
    return acc
  },
  {} as Record<string, TargetGroup[]>
)

const TARGET_CATEGORIES = Object.keys(GROUPED_TARGETS).sort((a, b) =>
  a.localeCompare(b)
)

const DEFAULT_TARGET =
  TARGET_CATEGORIES.length > 0 && GROUPED_TARGETS[TARGET_CATEGORIES[0]]?.length
    ? GROUPED_TARGETS[TARGET_CATEGORIES[0]][0].id
    : ''

export default function BuildNew() {
  const navigate = useNavigate()
  const ensureBuildFromConfig = useMutation(api.builds.ensureBuildFromConfig)
  const pluginFlashCounts = useQuery(api.plugins.getAll) ?? {}

  const STORAGE_KEY = 'quick_build_target'
  const persistTargetSelection = (targetId: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, targetId)
    } catch (error) {
      console.error('Failed to persist target selection', error)
    }
  }

  const [activeCategory, setActiveCategory] = useState<string>(
    TARGET_CATEGORIES[0] ?? ''
  )
  const [selectedTarget, setSelectedTarget] = useState<string>(DEFAULT_TARGET)
  const [selectedVersion, setSelectedVersion] = useState<string>(VERSIONS[0])
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({})
  const [pluginConfig, setPluginConfig] = useState<Record<string, boolean>>({})
  const [isFlashing, setIsFlashing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showModuleOverrides, setShowModuleOverrides] = useState(false)
  const [showPlugins, setShowPlugins] = useState(true)

  useEffect(() => {
    if (!activeCategory && TARGET_CATEGORIES.length > 0) {
      setActiveCategory(TARGET_CATEGORIES[0])
    }
  }, [activeCategory])

  useEffect(() => {
    if (!selectedTarget && activeCategory) {
      const first = GROUPED_TARGETS[activeCategory]?.[0]?.id
      if (first) {
        setSelectedTarget(first)
      }
    }
  }, [selectedTarget, activeCategory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedTarget = localStorage.getItem(STORAGE_KEY)
      if (savedTarget && TARGETS[savedTarget]) {
        setSelectedTarget(savedTarget)
        const category = TARGETS[savedTarget].category || 'Other'
        if (TARGET_CATEGORIES.includes(category)) {
          setActiveCategory(category)
        }
      }
    } catch (error) {
      console.error('Failed to read saved target', error)
    }
  }, [])

  const handleSelectTarget = (targetId: string) => {
    setSelectedTarget(targetId)
    persistTargetSelection(targetId)
    const category = TARGETS[targetId]?.category || 'Other'
    if (category && TARGET_CATEGORIES.includes(category)) {
      setActiveCategory(category)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedTarget) return
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, selectedTarget)
      }
    } catch (error) {
      console.error('Failed to initialize target storage', error)
    }
  }, [selectedTarget])

  const moduleCount = Object.keys(moduleConfig).length
  const pluginCount = Object.keys(pluginConfig).filter(
    (id) => pluginConfig[id] === true
  ).length
  const selectedTargetLabel =
    (selectedTarget && TARGETS[selectedTarget]?.name) || selectedTarget

  const handleToggleModule = (id: string, excluded: boolean) => {
    setModuleConfig((prev) => {
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
    setPluginConfig((prev) => {
      const next = { ...prev }
      if (enabled) {
        next[id] = true
      } else {
        delete next[id]
      }
      return next
    })
  }

  const handleFlash = async () => {
    if (!selectedTarget) return
    setIsFlashing(true)
    setErrorMessage(null)
    try {
      const pluginsEnabled = Object.keys(pluginConfig).filter(
        (id) => pluginConfig[id] === true
      )
      const result = await ensureBuildFromConfig({
        target: selectedTarget,
        version: selectedVersion,
        modulesExcluded: moduleConfig,
        pluginsEnabled: pluginsEnabled.length > 0 ? pluginsEnabled : undefined,
      })
      navigate(`/builds/${result.buildHash}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorMessage('Failed to start build. Please try again.')
      toast.error('Failed to start build', {
        description: message,
      })
    } finally {
      setIsFlashing(false)
    }
  }

  const isFlashDisabled = !selectedTarget || isFlashing

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-500">
              Quick build
            </p>
            <h1 className="text-4xl font-bold mt-1">
              Flash a custom firmware version
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Choose your Meshtastic target, adjust optional modules, and queue
              a new build instantly. We’ll send you to the build status page as
              soon as it starts.
            </p>
          </div>
        </div>

        <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {TARGET_CATEGORIES.map((category) => {
                const isActive = activeCategory === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/60">
              <div className="flex flex-wrap gap-2">
                {(activeCategory ? GROUPED_TARGETS[activeCategory] : [])?.map(
                  (target) => {
                    const isSelected = selectedTarget === target.id
                    return (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => handleSelectTarget(target.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {target.name}
                      </button>
                    )
                  }
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="build-version"
              className="block text-sm font-medium mb-2"
            >
              Firmware version
            </label>
            <select
              id="build-version"
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-800 bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {VERSIONS.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <button
              type="button"
              onClick={() => setShowModuleOverrides((prev) => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium">Core Modules</p>
                <p className="text-xs text-slate-400">
                  {moduleCount === 0
                    ? 'Using default modules for this target.'
                    : `${moduleCount} module${moduleCount === 1 ? '' : 's'} excluded.`}
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
                    Core Modules are officially maintained modules by
                    Meshtastic. They are selectively included or excluded by
                    default depending on the target device. You can explicitly
                    exclude modules you know you don't want.
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
                  {modulesData.modules.map((module) => (
                    <ModuleToggle
                      key={module.id}
                      id={module.id}
                      name={module.name}
                      description={module.description}
                      isExcluded={moduleConfig[module.id] === true}
                      onToggle={(excluded) =>
                        handleToggleModule(module.id, excluded)
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <button
              type="button"
              onClick={() => setShowPlugins((prev) => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium">Plugins</p>
                <p className="text-xs text-slate-400">
                  {pluginCount === 0
                    ? 'No plugins enabled.'
                    : `${pluginCount} plugin${pluginCount === 1 ? '' : 's'} enabled.`}
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
                    Plugins are 3rd party add-ons. They are not maintained,
                    endorsed, or supported by Meshtastic. Use at your own risk.
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
                <div className="grid gap-2 md:grid-cols-2">
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
                    .map(([slug, plugin]) => (
                      <PluginToggle
                        key={slug}
                        id={slug}
                        name={plugin.name}
                        description={plugin.description}
                        isEnabled={pluginConfig[slug] === true}
                        onToggle={(enabled) =>
                          handleTogglePlugin(slug, enabled)
                        }
                        featured={plugin.featured ?? false}
                        flashCount={pluginFlashCounts[slug] ?? 0}
                        homepage={plugin.homepage}
                        version={plugin.version}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleFlash}
              disabled={isFlashDisabled}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {isFlashing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Queuing build...
                </span>
              ) : (
                `Flash ${selectedTargetLabel || ''}`.trim() || 'Flash'
              )}
            </Button>
            {errorMessage && (
              <p className="text-sm text-red-400">{errorMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
