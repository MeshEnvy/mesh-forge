import { Switch } from '@/components/ui/switch'

interface ModuleToggleProps {
  id: string
  name: string
  description: string
  isExcluded: boolean
  onToggle: (excluded: boolean) => void
}

export function ModuleToggle({
  name,
  description,
  isExcluded,
  onToggle,
}: ModuleToggleProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border-2 border-slate-700 bg-slate-900/50 hover:border-slate-600 transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm mb-1">{name}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Switch
          checked={isExcluded}
          onCheckedChange={onToggle}
          labelLeft="Default"
          labelRight="Excluded"
          className={isExcluded ? 'bg-orange-600' : 'bg-slate-600'}
        />
      </div>
    </div>
  )
}
