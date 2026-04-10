import { Button } from "@/components/ui/button"
import { Check, CheckCircle2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { buildFlashParts, flashInstallRowsFromManifest, manifestFromMap } from "../lib/espFlashLayout"
import {
  ensureSerialPortClosed,
  isSerialUserCancelledError,
  pulseUsbBootloaderPort,
  runEspFlash,
  type FlashPhase,
} from "../lib/espFlashRun"
import { resolveFlashTargetFamily } from "../lib/flashTargetFamily"
import type { FlashManifest, FlashTargetFamily } from "../lib/untarGz"
import { extractTarGz } from "../lib/untarGz"

type FlashProgress =
  | { kind: "indeterminate"; label: string }
  | { kind: "determinate"; label: string; pct: number }
  | { kind: "complete" }

const PHASE_LABEL: Record<FlashPhase, string> = {
  connect: "Connecting to ROM bootloader…",
  detect: "Detecting flash size…",
  write: "Writing firmware…",
}

function unsupportedFlashMessage(family: FlashTargetFamily): string | null {
  if (family === "nrf52") {
    return "This bundle targets nRF52. In-browser flashing here uses esptool (ESP32). Use adafruit-nrfutil / nrfutil with the ZIP from Download bundle, or your board’s UF2/DFU workflow."
  }
  if (family === "rp2040") {
    return "This bundle targets RP2040. Use UF2 drag-and-drop or picotool with artifacts from Download bundle — Web Serial esptool here is for ESP32-class boards only."
  }
  if (family === "esp8266") {
    return "This bundle targets ESP8266. The embedded flasher is tuned for ESP32; use esptool.py locally with Download bundle if you need USB flashing."
  }
  return null
}

type EspFlasherProps = {
  bundleUrl: string
  /** PlatformIO env for the selected build; used if manifest omits targetFamily. */
  targetEnv?: string | null
  /** Primary CTA label (default matches standalone copy). */
  flashButtonLabel?: string
  flashBusyLabel?: string
  flashButtonSize?: "default" | "lg"
  className?: string
  /** Tighter copy when shown in the repo hero. */
  condensed?: boolean
}

export default function EspFlasher({
  bundleUrl,
  targetEnv = null,
  flashButtonLabel = "Connect serial & flash",
  flashBusyLabel = "Flashing…",
  flashButtonSize = "default",
  className = "",
  condensed = false,
}: EspFlasherProps) {
  const [busy, setBusy] = useState(false)
  const [eraseAll, setEraseAll] = useState(false)
  const [baud, setBaud] = useState(921600)
  const [layoutPreview, setLayoutPreview] = useState<FlashManifest | null>(null)
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null)
  const [bundleLoadError, setBundleLoadError] = useState<string | null>(null)
  const [dfuPulsedOnce, setDfuPulsedOnce] = useState(false)

  useEffect(() => {
    setDfuPulsedOnce(false)
    setLayoutPreview(null)
    setBundleLoadError(null)
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(bundleUrl)
        if (!res.ok) {
          if (!cancelled) setBundleLoadError(`Download failed: ${res.status}`)
          return
        }
        const buf = new Uint8Array(await res.arrayBuffer())
        const files = extractTarGz(buf)
        const m = manifestFromMap(files)
        if (!cancelled) {
          setLayoutPreview(m)
          setBundleLoadError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setBundleLoadError(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bundleUrl])

  const resolvedFamily = resolveFlashTargetFamily(layoutPreview, targetEnv)
  const flashBlockedReason = unsupportedFlashMessage(resolvedFamily)
  const canEspFlash = flashBlockedReason === null

  const installPlanRows = useMemo(
    () => (layoutPreview ? flashInstallRowsFromManifest(layoutPreview, eraseAll) : []),
    [layoutPreview, eraseAll]
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
    if (!canEspFlash) {
      toast.error("Unsupported for in-browser flash", { description: flashBlockedReason })
      return
    }
    if (!("serial" in navigator)) {
      toast.error("Web Serial is not supported in this browser")
      return
    }
    setBusy(true)
    setFlashProgress({ kind: "indeterminate", label: "Select a serial port…" })
    let finishedOk = false
    let port: SerialPort | undefined
    try {
      port = await navigator.serial.requestPort()
      setFlashProgress({ kind: "indeterminate", label: "Downloading firmware…" })
      const files = await prepareBundle()
      const parts = buildFlashParts(files, { eraseAll })
      if (!parts) {
        toast.error("Could not detect flash layout from bundle")
        return
      }

      await runEspFlash({
        port,
        parts,
        baud,
        eraseAll,
        onPhase: phase => {
          setFlashProgress({ kind: "indeterminate", label: PHASE_LABEL[phase] })
        },
        onWriteProgress: p => {
          setFlashProgress({
            kind: "determinate",
            label: `Writing firmware (${p.imageIndex + 1}/${p.imageCount})`,
            pct: p.overallPct,
          })
        },
      })
      finishedOk = true
      setFlashProgress({ kind: "complete" })
      toast.success("Flash complete")
    } catch (e) {
      if (isSerialUserCancelledError(e)) {
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      toast.error("Flash failed", { description: msg })
    } finally {
      if (port && !finishedOk) {
        void ensureSerialPortClosed(port)
      }
      setBusy(false)
      if (!finishedOk) {
        setFlashProgress(null)
      }
    }
  }, [baud, eraseAll, prepareBundle, canEspFlash, flashBlockedReason])

  const enterDfuMode = useCallback(async () => {
    try {
      await pulseUsbBootloaderPort()
      setDfuPulsedOnce(true)
      toast.success("1200-baud touch sent", {
        description:
          "If the device re-enumerated, pick the serial port and flash. If not, hold BOOT, tap RST, then try again.",
      })
    } catch (e) {
      if (isSerialUserCancelledError(e)) {
        return
      }
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const familyLine =
    resolvedFamily !== "esp32" || layoutPreview?.targetFamily
      ? `Target: ${resolvedFamily}${layoutPreview?.platform ? ` · ${layoutPreview.platform.trim()}` : ""}`
      : null

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3 ${className}`.trim()}>
      {condensed ? null : (
        <>
          <h3 className="text-lg font-semibold text-white">USB firmware flash (Web Serial)</h3>
          <p className="text-sm text-slate-400">
            esptool-js for ESP32-class layouts. Put the board in <strong>ROM serial-download mode</strong> if needed —
            use <strong>Enter DFU mode</strong> for the USB CDC 1200-baud touch when supported.
          </p>
        </>
      )}
      {condensed ? (
        <p className="text-sm text-slate-400">
          Chromium Web Serial + esptool-js (ESP32-class). Verify the flash map — wrong images can brick hardware.
        </p>
      ) : null}

      {bundleLoadError ? (
        <p className="text-xs text-amber-300/90">Could not prefetch bundle: {bundleLoadError}</p>
      ) : null}

      {familyLine ? <p className="text-xs font-mono text-slate-400">{familyLine}</p> : null}

      {flashBlockedReason ? (
        <p className="text-sm text-amber-200/90 rounded-md border border-amber-800/40 bg-amber-950/30 px-3 py-2">
          {flashBlockedReason}
        </p>
      ) : null}

      {layoutPreview ? (
        <div className="space-y-1">
          <table className="w-full text-left text-xs font-mono text-slate-300 border border-slate-600 rounded-md overflow-hidden">
            <thead className="bg-slate-800/80 text-slate-400">
              <tr>
                <th className="px-2 py-1.5 font-medium" scope="col">
                  Image
                </th>
                <th className="px-2 py-1.5 font-medium w-30" scope="col">
                  Offset
                </th>
                <th className="px-2 py-1.5 font-medium w-24 text-center" scope="col">
                  Install
                </th>
              </tr>
            </thead>
            <tbody>
              {installPlanRows.map((row, i) => (
                <tr key={`${row.offset}-${i}-${row.file}`} className="border-t border-slate-700/80">
                  <td className="px-2 py-1.5 break-all">{row.file}</td>
                  <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{row.offsetHex}</td>
                  <td className="px-2 py-1.5 text-center align-middle">
                    {row.willInstall ? (
                      <span className="inline-flex items-center justify-center text-emerald-400" title="Will flash">
                        <Check className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Yes</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center text-red-400" title="Skipped (enable full chip erase)">
                        <X className="h-4 w-4" aria-hidden />
                        <span className="sr-only">No</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500">
            Optional images are skipped unless <span className="text-slate-400">Full chip erase</span> is checked.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Default layout: bootloader @ 0x1000, partitions @ 0x8000, app @ 0x10000, optional boot_app0 @ 0xe000—or single
          firmware.bin @ 0x0. With <code className="text-slate-400">flash-manifest.json</code>, offsets come from the
          bundle.
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-slate-300 flex items-center gap-2">
          Baud
          <select
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white"
            value={baud}
            onChange={e => setBaud(Number(e.target.value))}
            disabled={!canEspFlash}
          >
            <option value={115200}>115200</option>
            <option value={460800}>460800</option>
            <option value={921600}>921600</option>
          </select>
        </label>
        <label className="text-sm text-slate-300 flex items-center gap-2">
          <input
            type="checkbox"
            checked={eraseAll}
            onChange={e => setEraseAll(e.target.checked)}
            disabled={!canEspFlash}
          />
          Full chip erase (destructive)
        </label>
      </div>

      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        <Button
          type="button"
          size={flashButtonSize}
          className="bg-amber-600 hover:bg-amber-700"
          disabled={busy || !canEspFlash}
          onClick={() => void flash()}
        >
          {busy ? flashBusyLabel : flashButtonLabel}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void enterDfuMode()}>
          {dfuPulsedOnce ? "Enter DFU mode (again)" : "Enter DFU mode"}
        </Button>
      </div>

      {flashProgress ? (
        flashProgress.kind === "complete" ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            <span className="text-sm font-medium text-emerald-300">Flashing complete</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">{flashProgress.label}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              {flashProgress.kind === "determinate" ? (
                <div
                  className="h-full rounded-full bg-amber-600 transition-[width] duration-150 ease-out"
                  style={{ width: `${flashProgress.pct}%` }}
                />
              ) : (
                <div className="h-full w-full rounded-full bg-amber-600/50 animate-pulse" aria-hidden />
              )}
            </div>
          </div>
        )
      ) : null}
    </div>
  )
}
