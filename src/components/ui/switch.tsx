import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  labelLeft?: string
  labelRight?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  labelLeft,
  labelRight,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-8 w-24 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-red-600' : 'bg-slate-600',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-6 w-6 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-[68px]' : 'translate-x-1'
        )}
      />
      {checked && labelRight && (
        <span className="absolute left-2 text-xs font-medium text-white">
          {labelRight}
        </span>
      )}
      {!checked && labelLeft && (
        <span className="absolute right-2 text-xs font-medium text-white">
          {labelLeft}
        </span>
      )}
    </button>
  )
}
