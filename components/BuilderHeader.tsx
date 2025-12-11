import { CheckCircle2 } from "lucide-react"

interface BuilderHeaderProps {
  preselectedPlugin?: {
    name: string
    description: string
    imageUrl?: string
    featured?: boolean
    includes?: string[]
  } | null
}

export function BuilderHeader({ preselectedPlugin }: BuilderHeaderProps) {
  return (
    <>
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
    </>
  )
}
