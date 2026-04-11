import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Github,
  Link2,
  Mail,
  PlayCircle,
  Share2,
  Smartphone,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { buildFlashParts, manifestFromMap, manifestHasFactorySection } from "../lib/espFlashLayout"
import {
  ensureSerialPortClosed,
  ESP_FLASH_WEB_BAUD,
  isSerialUserCancelledError,
  pulseUsbBootloaderOnPort,
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
  flashButtonLabel?: string
  flashBusyLabel?: string
  flashButtonSize?: "default" | "lg"
  className?: string
  /** Firmware source repo tree at this ref (no target / flash path segment). */
  githubRepoTreeHref?: string | null
  /** Mesh Forge GitHub Actions run for this build. */
  githubActionsRunHref?: string | null
  /** Download firmware bundle (icon button below controls). */
  onDownloadBundle?: (() => void) | null
  /** Current page URL for the share popover (exact flasher view). */
  sharePageUrl?: string | null
  /** Omit outer card chrome when parent already provides the bordered container. */
  embedded?: boolean
}

export default function EspFlasher({
  bundleUrl,
  targetEnv = null,
  flashButtonLabel = "Flash",
  flashBusyLabel = "Writing…",
  flashButtonSize = "lg",
  className = "",
  githubRepoTreeHref = null,
  githubActionsRunHref = null,
  onDownloadBundle = null,
  sharePageUrl = null,
  embedded = false,
}: EspFlasherProps) {
  const [busy, setBusy] = useState(false)
  const shareDialogRef = useRef<HTMLDialogElement>(null)
  const [eraseFlashForFactory, setEraseFlashForFactory] = useState(false)
  const [layoutPreview, setLayoutPreview] = useState<FlashManifest | null>(null)
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null)
  const [bundleLoadError, setBundleLoadError] = useState<string | null>(null)

  useEffect(() => {
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
          setEraseFlashForFactory(prev => (manifestHasFactorySection(m) ? prev : false))
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

  const hasFactorySection = useMemo(() => manifestHasFactorySection(layoutPreview), [layoutPreview])

  const prepareBundle = useCallback(async () => {
    const res = await fetch(bundleUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const buf = new Uint8Array(await res.arrayBuffer())
    const files = extractTarGz(buf)
    const m = manifestFromMap(files)
    setLayoutPreview(m)
    setEraseFlashForFactory(prev => (manifestHasFactorySection(m) ? prev : false))
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
      setFlashProgress({ kind: "indeterminate", label: "USB bootloader reset…" })
      await pulseUsbBootloaderOnPort(port)

      setFlashProgress({ kind: "indeterminate", label: "Downloading firmware…" })
      const files = await prepareBundle()
      const plan = buildFlashParts(files, {
        factoryInstall: eraseFlashForFactory,
        resetDeviceStorage: false,
      })
      if (!plan) {
        toast.error("Could not detect flash layout from bundle")
        return
      }

      await runEspFlash({
        port,
        parts: plan.parts,
        baud: ESP_FLASH_WEB_BAUD,
        eraseAll: plan.eraseAll,
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
  }, [eraseFlashForFactory, prepareBundle, canEspFlash, flashBlockedReason])

  const shareUrlTrimmed = useMemo(() => sharePageUrl?.trim() ?? "", [sharePageUrl])
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  const closeShareDialog = useCallback(() => {
    shareDialogRef.current?.close()
  }, [])

  const hasIconRow =
    Boolean(githubRepoTreeHref?.trim()) ||
    Boolean(githubActionsRunHref?.trim()) ||
    typeof onDownloadBundle === "function" ||
    Boolean(shareUrlTrimmed)

  const copyShareLink = useCallback(async () => {
    if (!shareUrlTrimmed) return
    try {
      await navigator.clipboard.writeText(shareUrlTrimmed)
      toast.success("Link copied")
      closeShareDialog()
    } catch {
      toast.error("Could not copy link")
    }
  }, [shareUrlTrimmed, closeShareDialog])

  const openNativeShare = useCallback(async () => {
    if (!shareUrlTrimmed || !canNativeShare) return
    try {
      await navigator.share({
        url: shareUrlTrimmed,
        title: "Mesh Forge Web Flasher",
      })
      closeShareDialog()
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Share was cancelled or failed")
    }
  }, [shareUrlTrimmed, canNativeShare, closeShareDialog])

  const rootClass = embedded
    ? `space-y-3 ${className}`.trim()
    : `rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3 ${className}`.trim()

  return (
    <div className={rootClass}>
      {bundleLoadError ? (
        <p className="text-xs text-amber-300/90">Could not prefetch bundle: {bundleLoadError}</p>
      ) : null}

      {flashBlockedReason ? (
        <p className="text-sm text-amber-200/90 rounded-md border border-amber-800/40 bg-amber-950/30 px-3 py-2">
          {flashBlockedReason}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="button"
          size={flashButtonSize}
          className="bg-amber-600 hover:bg-amber-700"
          disabled={busy || !canEspFlash}
          onClick={() => void flash()}
        >
          {busy ? flashBusyLabel : flashButtonLabel}
        </Button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={eraseFlashForFactory}
            aria-label="Full device reset (erase and reinstall from scratch)"
            disabled={!canEspFlash || busy || !hasFactorySection}
            onClick={() => setEraseFlashForFactory(v => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 ${
              eraseFlashForFactory ? "bg-amber-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                eraseFlashForFactory ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-slate-200">Full device reset</span>
        </div>
      </div>

      {!hasFactorySection ? (
        <p className="text-xs text-amber-300/90">
          Full device reset is not available for this bundle—only an update. Typical reasons: an older download, a
          build that did not include a factory image, or firmware not produced by this app’s usual ESP32 flow.
        </p>
      ) : null}

      {eraseFlashForFactory ? (
        <p
          className="text-sm text-amber-200/90 rounded-md border border-amber-800/40 bg-amber-950/25 px-3 py-2"
          role="status"
        >
          <strong className="font-semibold text-amber-100">You will lose everything on the radio:</strong> channels and
          settings, private keys, node info, message history, and any stored maps or telemetry. Only use this if you are
          deliberately starting over or recovering a bad state.
        </p>
      ) : null}

      {hasIconRow ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {githubRepoTreeHref?.trim() ? (
            <a
              href={githubRepoTreeHref.trim()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              title="View source on GitHub"
            >
              <Github className="h-5 w-5" aria-hidden />
              <span className="sr-only">View source on GitHub</span>
            </a>
          ) : null}
          {githubActionsRunHref?.trim() ? (
            <a
              href={githubActionsRunHref.trim()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              title="View build on GitHub"
            >
              <PlayCircle className="h-5 w-5" aria-hidden />
              <span className="sr-only">View build on GitHub</span>
            </a>
          ) : null}
          {typeof onDownloadBundle === "function" ? (
            <button
              type="button"
              onClick={() => onDownloadBundle()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              title="Download bundle"
            >
              <Download className="h-5 w-5" aria-hidden />
              <span className="sr-only">Download bundle</span>
            </button>
          ) : null}
          {shareUrlTrimmed ? (
            <>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Share this page"
                onClick={() => shareDialogRef.current?.showModal()}
              >
                <Share2 className="h-5 w-5" aria-hidden />
                <span className="sr-only">Share this page</span>
              </button>
              <dialog
                ref={shareDialogRef}
                className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-slate-100 backdrop:bg-slate-950/65 backdrop:backdrop-blur-[2px]"
                onClick={e => {
                  if (e.target === e.currentTarget) closeShareDialog()
                }}
              >
                <div
                  className="flex min-h-full w-full items-center justify-center p-4 sm:p-8"
                  onClick={e => {
                    if (e.target === e.currentTarget) closeShareDialog()
                  }}
                >
                  <div
                    className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-600/70 bg-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_25px_80px_-12px_rgba(0,0,0,0.85)]"
                    onClick={e => e.stopPropagation()}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-500/50 to-transparent"
                      aria-hidden
                    />
                    <header className="border-b border-slate-800/90 bg-slate-900/40 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                      <button
                        type="button"
                        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70"
                        onClick={closeShareDialog}
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" aria-hidden />
                      </button>
                      <div className="flex gap-4 pr-10">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500/20 to-cyan-600/10 text-amber-400 ring-1 ring-amber-500/25">
                          <Share2 className="h-6 w-6" aria-hidden />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h2 className="text-lg font-semibold tracking-tight text-slate-50">Share Web Flasher</h2>
                          <p className="text-sm leading-relaxed text-slate-400">
                            Same firmware view in Mesh Forge — repo, ref, target, and bundle.
                          </p>
                        </div>
                      </div>
                    </header>
                    <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Link</p>
                        <p className="mt-2 max-h-24 overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-900/60 px-3.5 py-3 font-mono text-[12px] leading-snug text-slate-300 wrap-anywhere">
                          {shareUrlTrimmed}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          className="h-11 w-full gap-2 bg-amber-600 text-white hover:bg-amber-500"
                          onClick={() => void copyShareLink()}
                        >
                          <Link2 className="h-4 w-4" aria-hidden />
                          Copy link
                        </Button>
                        {canNativeShare ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-full gap-2 border-slate-600 bg-slate-900/50 text-slate-100 hover:bg-slate-800"
                            onClick={() => void openNativeShare()}
                          >
                            <Smartphone className="h-4 w-4" aria-hidden />
                            Share via this device
                          </Button>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Open or post</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Open in new tab"
                            className="h-11 gap-2 border-slate-600 bg-slate-900/40 text-slate-200 hover:bg-slate-800"
                            onClick={() => {
                              window.open(shareUrlTrimmed, "_blank", "noopener,noreferrer")
                              closeShareDialog()
                            }}
                          >
                            <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            <span className="truncate">New tab</span>
                          </Button>
                          <a
                            href={`mailto:?subject=${encodeURIComponent("Mesh Forge Web Flasher")}&body=${encodeURIComponent(shareUrlTrimmed)}`}
                            title="Email this link"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                            onClick={closeShareDialog}
                          >
                            <Mail className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            <span className="truncate">Email</span>
                          </a>
                          <a
                            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrlTrimmed)}&text=${encodeURIComponent("Mesh Forge Web Flasher")}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Post on X"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                            onClick={closeShareDialog}
                          >
                            <span className="shrink-0 text-[13px] font-bold leading-none text-slate-100" aria-hidden>
                              𝕏
                            </span>
                            <span className="truncate">X</span>
                          </a>
                          <a
                            href={`https://bsky.app/intent/compose?text=${encodeURIComponent(shareUrlTrimmed)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Post on Bluesky"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-900/40 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                            onClick={closeShareDialog}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" aria-hidden />
                            <span className="truncate">Bluesky</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </dialog>
            </>
          ) : null}
        </div>
      ) : null}

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
