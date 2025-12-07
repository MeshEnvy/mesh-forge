import { PluginCard } from "@/components/PluginCard"
import registryData from "@/public/registry.json"
import { PluginDisplay } from "@/types"

export default function PluginsPage() {
  const plugins = Object.entries(registryData).sort(([, pluginA], [, pluginB]) => {
    // Featured plugins first
    const featuredA = pluginA.featured ?? false
    const featuredB = pluginB.featured ?? false
    if (featuredA !== featuredB) {
      return featuredA ? -1 : 1
    }
    // Then alphabetical by name
    return pluginA.name.localeCompare(pluginB.name)
  })

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Plugin Registry</h1>
          <p className="text-slate-400 max-w-2xl">
            Browse community-developed plugins that extend Meshtastic firmware functionality. Featured plugins are shown
            first.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {plugins.map(([slug, plugin]) => {
            const pluginDisplay = plugin as PluginDisplay
            return (
              <PluginCard
                key={slug}
                variant="link"
                id={slug}
                name={pluginDisplay.name}
                description={pluginDisplay.description}
                imageUrl={pluginDisplay.imageUrl}
                featured={pluginDisplay.featured ?? false}
                repo={pluginDisplay.repo}
                homepage={pluginDisplay.homepage}
                version={pluginDisplay.version}
                downloads={pluginDisplay.downloads}
                stars={pluginDisplay.stars}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
