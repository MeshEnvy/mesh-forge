import { ModuleToggle } from "@/components/ModuleToggle"
import modulesData from "@/convex/modules.json"
import { ChevronDown, ChevronRight } from "lucide-react"

interface ModuleConfigProps {
  moduleConfig: Record<string, boolean>
  showModuleOverrides: boolean
  onToggleShow: () => void
  onToggleModule: (id: string, excluded: boolean) => void
  onReset: () => void
}

export function ModuleConfig({
  moduleConfig,
  showModuleOverrides,
  onToggleShow,
  onToggleModule,
  onReset,
}: ModuleConfigProps) {
  const moduleCount = Object.keys(moduleConfig).length

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
      <button type="button" onClick={onToggleShow} className="w-full flex items-center justify-between text-left">
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
              Core Modules are officially maintained modules by Meshtastic. They are selectively included or excluded by
              default depending on the target device. You can explicitly exclude modules you know you don't want.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-white underline"
              onClick={onReset}
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
                onToggle={excluded => onToggleModule(module.id, excluded)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
