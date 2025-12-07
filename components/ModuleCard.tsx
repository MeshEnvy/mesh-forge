interface ModuleCardProps {
  name: string
  description: string
  selected: boolean
  onClick: () => void
}

export function ModuleCard({ name, description, selected, onClick }: ModuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all
        ${selected ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-900/50 hover:border-slate-600"}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <div
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center
              ${selected ? "border-blue-500 bg-blue-500" : "border-slate-500"}
            `}
          >
            {selected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Checkmark</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">{name}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}
