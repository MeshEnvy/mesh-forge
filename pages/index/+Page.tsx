import { DiscordButton } from "@/components/DiscordButton"
import { PluginCard } from "@/components/PluginCard"
import { RedditButton } from "@/components/RedditButton"
import { Button } from "@/components/ui/button"
import registryData from "@/public/registry.json"
import { navigate } from "vike/client/router"

function QuickBuildIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Custom build"
      {...props}
    >
      <title>Custom build</title>
      <path fill="currentColor" d="M11 15H6l7-14v8h5l-7 14z" />
    </svg>
  )
}

function DocsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Docs"
      {...props}
    >
      <title>Docs</title>
      <path
        fill="currentColor"
        d="M6.75 22q-1.125 0-1.937-.763T4 19.35V5.4q0-.95.588-1.7t1.537-.95L16 .8v16l-9.475 1.9q-.225.05-.375.238T6 19.35q0 .275.225.463T6.75 20H18V4h2v18zM7 16.575l2-.4V4.225l-2 .4z"
      />
    </svg>
  )
}

export default function LandingPage() {
  const featuredPlugins = Object.entries(registryData)
    .filter(([, plugin]) => plugin.featured === true)
    .sort(([, pluginA], [, pluginB]) => pluginA.name.localeCompare(pluginB.name))

  const customBuildPlugin = {
    id: "custom-build",
    name: "Build your own",
    description: "Create a custom firmware build with your choice of plugins and modules",
    imageUrl: "/custom-build.webp",
    featured: false,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-20 px-8">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent inline-block pb-2">
              Mesh beyond the basics
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10">
            Build custom firmware with third-party plugins: BBS's, custom hardware, games, and more. An open ecosystem
            growing to hundreds of plugins.
          </p>

          {featuredPlugins.length > 0 && (
            <div className="mb-10">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 pb-24 md:pb-8 max-w-6xl mx-auto relative">
                <h2 className="text-2xl font-bold mb-6 text-center">Popular Builds</h2>
                <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(260px,260px))] gap-4 auto-rows-fr justify-center">
                  {featuredPlugins.map(([slug, plugin]) => (
                    <div key={slug} className="h-full">
                      <PluginCard
                        variant="link"
                        id={slug}
                        name={plugin.name}
                        description={plugin.description}
                        imageUrl={plugin.imageUrl}
                        featured={false}
                        repo={plugin.repo}
                        homepage={plugin.homepage}
                        version={plugin.version}
                        downloads={plugin.downloads}
                        stars={plugin.stars}
                      />
                    </div>
                  ))}
                  <div className="h-full">
                    <PluginCard
                      variant="link"
                      id={customBuildPlugin.id}
                      name={customBuildPlugin.name}
                      description={customBuildPlugin.description}
                      imageUrl={customBuildPlugin.imageUrl}
                      featured={false}
                      href="/builds/new"
                      prominent={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 mb-10">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => navigate("/docs")}
                size="default"
                variant="default"
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0 shadow-lg shadow-cyan-500/50"
              >
                <DocsIcon className="mr-2 h-4 w-4" />
                Docs
              </Button>
              <DiscordButton
                size="default"
                variant="default"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-purple-500/50"
              />
              <RedditButton
                size="default"
                variant="default"
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-lg shadow-orange-500/50"
              />
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-10">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Zero Install</h3>
              <p className="text-slate-300 text-sm">No downloads, no toolchains. Everything runs in your browser.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Custom Firmware</h3>
              <p className="text-slate-300 text-sm">Build bespoke Meshtastic firmware tailored to your exact needs.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Community Extensions</h3>
              <p className="text-slate-300 text-sm">Include community modules and extensions beyond core Meshtastic.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left md:col-span-2 lg:col-span-1">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Share & Remix</h3>
              <p className="text-slate-300 text-sm">Publish your build profiles and let others remix your configs.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left md:col-span-2 lg:col-span-2">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Cloud Builds</h3>
              <p className="text-slate-300 text-sm">
                Compile in the cloud, flash directly to your device—no local setup required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
