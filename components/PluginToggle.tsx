import { Switch } from "@/components/ui/switch"
import { ExternalLink, Star } from "lucide-react"

interface PluginToggleProps {
  id: string
  name: string
  description: string
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
  featured?: boolean
  flashCount?: number
  homepage?: string
  version?: string
  disabled?: boolean
  enabledLabel?: string
  incompatibleReason?: string
}

export function PluginToggle({
  name,
  description,
  isEnabled,
  onToggle,
  featured = false,
  flashCount = 0,
  homepage,
  version,
  disabled = false,
  enabledLabel = "Add",
  incompatibleReason,
}: PluginToggleProps) {
  const isIncompatible = !!incompatibleReason

  return (
    <div
      className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-colors ${
        isIncompatible
          ? "border-slate-800 bg-slate-900/30 opacity-60 cursor-not-allowed"
          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
      }`}
    >
      {/* Flash count and homepage links in lower right */}
      <div className="absolute bottom-2 right-2 flex items-center gap-3 text-xs text-slate-400 z-10">
        {version && <span className="text-slate-500">v{version}</span>}
        <div className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="text-slate-400"
            fill="currentColor"
            role="img"
            aria-label="Download"
          >
            <path d="m14 2l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 18V9h-5V4H6v16zm-6-1l-4-4h2.5v-3h3v3H16z" />
          </svg>
          <span>{flashCount}</span>
        </div>
        {homepage && (
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-300 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className={`font-semibold text-sm ${isIncompatible ? "text-slate-500" : ""}`}>{name}</h4>
          {featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
        </div>
        <p className={`text-xs leading-relaxed ${isIncompatible ? "text-slate-500" : "text-slate-400"}`}>
          {description}
        </p>
        {isIncompatible && incompatibleReason && (
          <p className="text-xs text-red-400 mt-1 font-medium">{incompatibleReason}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          labelLeft="Skip"
          labelRight={enabledLabel}
          className={isEnabled ? "bg-green-600" : "bg-slate-600"}
        />
      </div>
    </div>
  )
}
