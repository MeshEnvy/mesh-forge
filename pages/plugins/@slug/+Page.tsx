import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import registryData from "@/public/registry.json"
import { PluginDisplay } from "@/types"
import { useQuery } from "convex/react"
import { Download, Github, Home, Star } from "lucide-react"
import { usePageContext } from "vike-react/usePageContext"
import { navigate } from "vike/client/router"

function getGitHubStarsBadgeUrl(repoUrl?: string): string | null {
  if (!repoUrl) return null
  try {
    const url = new URL(repoUrl)
    if (url.hostname === "github.com" || url.hostname === "www.github.com") {
      const pathParts = url.pathname.split("/").filter(Boolean)
      if (pathParts.length >= 2) {
        const owner = pathParts[0]
        const repo = pathParts[1]
        return `https://img.shields.io/github/stars/${owner}/${repo}?style=flat&logo=github&logoColor=white&labelColor=rgb(0,0,0,0)&color=rgb(30,30,30)&label=★`
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

export default function PluginPage() {
  const pageContext = usePageContext()
  const slug = pageContext.routeParams?.slug as string | undefined
  const pluginStats = useQuery(api.plugins.get, slug ? { slug } : "skip")

  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-300">Plugin slug missing.</p>
        </div>
      </div>
    )
  }

  const plugin = (registryData as Record<string, PluginDisplay>)[slug]
  const starsBadgeUrl = getGitHubStarsBadgeUrl(plugin?.repo)

  if (!plugin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
            <p className="text-slate-300">
              Plugin <span className="font-mono">{slug}</span> not found.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-6 space-y-6">
          <div className="flex items-start gap-6">
            {plugin.imageUrl && (
              <img
                src={plugin.imageUrl}
                alt={`${plugin.name} logo`}
                className="w-24 h-24 rounded-lg object-contain shrink-0"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{plugin.name}</h1>
                {plugin.featured && (
                  <span className="px-2 py-1 text-xs font-medium text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded">
                    <Star className="w-3 h-3 inline mr-1 fill-yellow-400" />
                    Featured
                  </span>
                )}
              </div>
              <p className="text-slate-300 text-lg mb-4">{plugin.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                {plugin.version && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Version:</span>
                    <span className="font-mono text-white">v{plugin.version}</span>
                  </div>
                )}
                {plugin.author && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Author:</span>
                    <span className="text-white">{plugin.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  <span>{(pluginStats?.flashCount ?? 0).toLocaleString()}</span>
                </div>
                {starsBadgeUrl && plugin.repo && (
                  <a
                    href={plugin.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img src={starsBadgeUrl} alt="GitHub stars" className="h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            {plugin.repo && (
              <Button
                onClick={() => window.open(plugin.repo, "_blank", "noopener,noreferrer")}
                variant="outline"
                className="border-slate-600 hover:bg-slate-800"
              >
                <Github className="w-4 h-4 mr-2" />
                View Repository
              </Button>
            )}
            {plugin.homepage && plugin.homepage !== plugin.repo && (
              <Button
                onClick={() => window.open(plugin.homepage, "_blank", "noopener,noreferrer")}
                variant="outline"
                className="border-slate-600 hover:bg-slate-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Homepage
              </Button>
            )}
            <Button onClick={() => navigate(`/builds?plugin=${slug}`)} className="bg-cyan-600 hover:bg-cyan-700">
              Build with this Plugin
            </Button>
          </div>

          {plugin.dependencies && Object.keys(plugin.dependencies).length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h2 className="text-lg font-semibold mb-3">Dependencies</h2>
              <div className="space-y-2">
                {Object.entries(plugin.dependencies).map(([depName, depVersion]) => (
                  <div key={depName} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">{depName}:</span>
                    <span className="font-mono text-white">{depVersion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plugin.includes && plugin.includes.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h2 className="text-lg font-semibold mb-3">Supported Platforms</h2>
              <div className="flex flex-wrap gap-2">
                {plugin.includes.map(platform => (
                  <span
                    key={platform}
                    className="px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
