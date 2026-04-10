import { useId } from 'react'

type AutocompleteFieldProps = {
  label: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  id?: string
  placeholder?: string
  /** Single-row toolbar: label left, input grows. */
  layout?: 'stacked' | 'inline'
}

/** Native `<datalist>`-backed field: typeahead from the browser + keyboard friendly. */
export function AutocompleteField({
  label,
  options,
  value,
  onChange,
  onBlur,
  disabled,
  id,
  placeholder = 'Type or pick from list…',
  layout = 'stacked',
}: AutocompleteFieldProps) {
  const rid = useId().replace(/:/g, '')
  const inputId = id ?? `ac-${rid}`
  const listId = `${inputId}-options`

  const inputClass =
    layout === 'inline'
      ? 'h-9 min-w-[7rem] flex-1 bg-slate-900 border border-slate-700 rounded-md px-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/50 disabled:cursor-not-allowed disabled:opacity-50'
      : 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <label
      className={
        layout === 'inline'
          ? 'flex min-w-0 max-w-[min(100%,18rem)] flex-1 items-center gap-2 sm:max-w-[20rem]'
          : 'block w-full space-y-1.5'
      }
    >
      <span
        className={
          layout === 'inline'
            ? 'shrink-0 text-xs font-medium text-slate-500 w-14 sm:w-16'
            : 'text-sm font-medium text-slate-400'
        }
      >
        {label}
      </span>
      <input
        id={inputId}
        type="text"
        className={inputClass}
        list={options.length ? listId : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {options.length ? (
        <datalist id={listId}>
          {options.map(o => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ) : null}
    </label>
  )
}
