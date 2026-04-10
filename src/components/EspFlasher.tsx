import { Button } from '@/components/ui/button'
import { buildFlashParts, layoutPreviewFromManifest, manifestFromMap, type FlashManifest } from '../lib/espFlashLayout'
import { pulseUsbBootloaderPort, runEspFlash } from '../lib/espFlashRun'
import { extractTarGz, findInTar } from '../lib/untarGz'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

type EspFlasherProps = {
  bundleUrl: string
  /** Primary CTA label (default matches standalone copy). */
  flashButtonLabel?: string
  flashBusyLabel?: string
  flashButtonSize?: 'default' | 'lg'
  className?: string
  /** Tighter copy when shown in the repo hero. */
  condensed?: boolean
}

export default function EspFlasher({
  bundleUrl,
  flashButtonLabel = 'Connect serial & flash',
  flashBusyLabel = 'Flashing…',
  flashButtonSize = 'default',
  className = '',
  condensed = false,
}: EspFlasherProps) {
  const [busy, setBusy] = useState(false)
  const [eraseAll, setEraseAll] = useState(false)
  const [noReset, setNoReset] = useState(false)
  const [baud, setBaud] = useState(921600)
  const [layoutPreview, setLayoutPreview] = useState<FlashManifest | null>(null)
  const [log, setLog] = useState('')
  const logRef = useRef('')

  const terminal = useMemo(
    () => ({
      clean: () => {
        logRef.current = ''
        setLog('')
      },
      write: (data: string) => {
        logRef.current += data
        setLog(logRef.current)
      },
      writeLine: (data: string) => {
        logRef.current += data + '\n'
        setLog(logRef.current)
      },
    }),
    []
  )

  const prepareBundle = useCallback(async () => {
    const res = await fetch(bundleUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const buf = new Uint8Array(await res.arrayBuffer())
    const files = extractTarGz(buf)
    const m = manifestFromMap(files)
    setLayoutPreview(m)
    return files
  }, [bundleUrl])

  const flash = useCallback(async () => {
    if (!('serial' in navigator)) {
      toast.error('Web Serial is not supported in this browser')
      return
    }
    setBusy(true)
    terminal.clean()
    try {
      const files = await prepareBundle()
      const parts = buildFlashParts(files)
      if (!parts) {
        toast.error('Could not detect flash layout from bundle')
        setBusy(false)
        return
      }

      await runEspFlash({
        parts,
        baud,
        eraseAll,
        terminal,
        resetMode: noReset ? 'no_reset' : 'default_reset',
      })
      toast.success('Flash complete')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      terminal.writeLine(`\nError: ${msg}`)
      toast.error('Flash failed', { description: msg })
    } finally {
      setBusy(false)
    }
  }, [baud, eraseAll, noReset, prepareBundle, terminal])

  const boot1200 = useCallback(async () => {
    try {
      await pulseUsbBootloaderPort()
      toast.success('1200 baud pulse sent', {
        description: 'If the board did not enter bootloader, hold BOOT, tap RST, then try flash again.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return (
    <div
      className={`rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3 ${className}`.trim()}
    >
      {condensed ? null : (
        <>
          <h3 className="text-lg font-semibold text-white">ESP flash (Web Serial)</h3>
          <p className="text-sm text-slate-400">
            Uses esptool-js. Connect USB, put the board in bootloader if needed, then flash. Wrong offsets can brick
            hardware—verify the map.
          </p>
        </>
      )}
      {condensed ? (
        <p className="text-sm text-slate-400">
          USB + Chromium Web Serial. Verify the flash map before writing—wrong images can brick hardware.
        </p>
      ) : null}

      {layoutPreview ? (
        <ul className="text-xs font-mono text-slate-300 space-y-1">
          {layoutPreviewFromManifest(layoutPreview).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">
          Default layout: bootloader @ 0x1000, partitions @ 0x8000, app @ 0x10000, optional boot_app0 @ 0xe000—or
          single firmware.bin @ 0x0. With <code className="text-slate-400">flash-manifest.json</code>, offsets come
          from the bundle.
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-slate-300 flex items-center gap-2">
          Baud
          <select
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
            value={baud}
            onChange={e => setBaud(Number(e.target.value))}
          >
            <option value={115200}>115200</option>
            <option value={460800}>460800</option>
            <option value={921600}>921600</option>
          </select>
        </label>
        <label className="text-sm text-slate-300 flex items-center gap-2">
          <input type="checkbox" checked={eraseAll} onChange={e => setEraseAll(e.target.checked)} />
          Full chip erase (destructive)
        </label>
        <label className="text-sm text-slate-300 flex items-center gap-2">
          <input type="checkbox" checked={noReset} onChange={e => setNoReset(e.target.checked)} />
          No auto-reset (hold BOOT manually)
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        <Button
          type="button"
          size={flashButtonSize}
          className="bg-amber-600 hover:bg-amber-700"
          disabled={busy}
          onClick={() => void flash()}
        >
          {busy ? flashBusyLabel : flashButtonLabel}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void boot1200()}>
          1200 baud reset
        </Button>
      </div>

      {log ? (
        <pre className="text-xs text-slate-400 max-h-48 overflow-auto whitespace-pre-wrap bg-black/40 p-2 rounded">
          {log}
        </pre>
      ) : null}
    </div>
  )
}
