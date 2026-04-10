import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

type Row = { kind: 'clear' } | { kind: 'opt'; value: string }

type ComboboxFieldProps = {
  label: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  placeholder?: string
  layout?: 'stacked' | 'inline'
  /** When set and `value` is non-empty, first row clears selection (`onChange('')`). */
  clearSelectionLabel?: string
  /** Match by letters/digits only (case-insensitive); ignores spaces and punctuation in query and options. */
  filterNormalize?: boolean
}

function normalizeForFilter(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function buildRows(
  options: readonly string[],
  filter: string,
  clearSelectionLabel: string | undefined,
  value: string,
  filterNormalize: boolean
): Row[] {
  let filtered: readonly string[]
  if (filterNormalize) {
    const nq = normalizeForFilter(filter)
    filtered = !nq ? [...options] : options.filter(o => normalizeForFilter(o).includes(nq))
  } else {
    const q = filter.trim().toLowerCase()
    filtered = !q ? [...options] : options.filter(o => o.toLowerCase().includes(q))
  }
  const r: Row[] = []
  if (clearSelectionLabel && value) r.push({ kind: 'clear' })
  for (const o of filtered) r.push({ kind: 'opt', value: o })
  return r
}

/**
 * Searchable list combobox (Radix Popover). Unlike `<datalist>`, the full option list stays
 * available while open so arrow keys and scrolling work after a value is selected.
 */
export function ComboboxField({
  label,
  options,
  value,
  onChange,
  disabled,
  id,
  placeholder = 'Choose…',
  layout = 'stacked',
  clearSelectionLabel,
  filterNormalize = false,
}: ComboboxFieldProps) {
  const rid = useId().replace(/:/g, '')
  const triggerId = id ?? `cb-${rid}`
  const labelId = `${triggerId}-label`
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const filterInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const rows = useMemo(
    () => buildRows(options, filter, clearSelectionLabel, value, filterNormalize),
    [options, filter, clearSelectionLabel, value, filterNormalize]
  )

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFilter('')
      const initial = buildRows(options, '', clearSelectionLabel, value, filterNormalize)
      const idx = initial.findIndex(row => row.kind === 'opt' && row.value === value)
      setHighlighted(idx >= 0 ? idx : 0)
    } else {
      setFilter('')
    }
    setOpen(next)
  }

  useEffect(() => {
    if (!open) return
    setHighlighted(h => Math.min(h, Math.max(0, rows.length - 1)))
  }, [rows.length, open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => filterInputRef.current?.focus())
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector(`[data-row-index="${highlighted}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open, rows.length])

  const selectRow = (row: Row) => {
    if (row.kind === 'clear') {
      onChange('')
    } else {
      onChange(row.value)
    }
    setFilter('')
    setOpen(false)
  }

  const onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, Math.max(0, rows.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter' && rows.length > 0) {
      e.preventDefault()
      const row = rows[highlighted]
      if (row) selectRow(row)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const triggerClass =
    layout === 'inline'
      ? 'h-9 min-w-[7rem] flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-600/50'
      : 'h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-600/50'

  const labelWrapClass =
    layout === 'inline'
      ? 'flex min-w-0 max-w-[min(100%,18rem)] flex-1 items-center gap-2 sm:max-w-[20rem]'
      : 'block w-full space-y-1.5'

  const labelTextClass =
    layout === 'inline' ? 'w-14 shrink-0 text-xs font-medium text-slate-500 sm:w-16' : 'text-sm font-medium text-slate-400'

  return (
    <div className={labelWrapClass}>
      <span id={labelId} className={labelTextClass}>
        {label}
      </span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby={labelId}
            className={cn(triggerClass, 'inline-flex items-center justify-between gap-1 text-left font-normal')}
          >
            <span className={cn('min-w-0 truncate', !value && 'text-slate-600')}>{value || placeholder}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0"
          onOpenAutoFocus={e => e.preventDefault()}
          align="start"
        >
          <div className="border-b border-slate-800 p-1.5">
            <input
              ref={filterInputRef}
              type="text"
              value={filter}
              onChange={e => {
                setFilter(e.target.value)
                setHighlighted(0)
              }}
              onKeyDown={onFilterKeyDown}
              placeholder="Filter…"
              className="h-8 w-full rounded border border-slate-800 bg-slate-950 px-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-600/50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul ref={listRef} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto py-1" tabIndex={-1}>
            {rows.length === 0 ? (
              <li className="px-2 py-2 text-sm text-slate-500">No matches</li>
            ) : (
              rows.map((row, i) => (
                <li
                  key={row.kind === 'clear' ? '__clear__' : row.value}
                  role="option"
                  aria-selected={i === highlighted}
                  data-row-index={i}
                  className={cn(
                    'cursor-pointer px-2 py-1.5 text-sm',
                    i === highlighted ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800/60'
                  )}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectRow(row)}
                >
                  {row.kind === 'clear' ? (
                    <span className="text-slate-400">{clearSelectionLabel}</span>
                  ) : (
                    row.value
                  )}
                </li>
              ))
            )}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
