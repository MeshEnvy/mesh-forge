import { ESPLoader, Transport, type FlashSizeValues } from "esptool-js"
import type { FlashPart } from "./espFlashLayout"

export type EspTerminal = {
  clean: () => void
  write: (data: string) => void
  writeLine: (data: string) => void
}

export const noopEspTerminal: EspTerminal = {
  clean: () => {},
  write: () => {},
  writeLine: () => {},
}

export function isSerialUserCancelledError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "NotFoundError") return true
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes("No port selected")
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isPortAlreadyOpenError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "InvalidStateError") return true
  const msg = e instanceof Error ? e.message : String(e)
  return /already open/i.test(msg)
}

/**
 * When readable/writable exist, the port is still open. Close it so a later `open()` succeeds.
 * Handles failed prior sessions that skipped `disconnect()` or a `close()` that threw.
 */
export async function ensureSerialPortClosed(port: SerialPort): Promise<void> {
  if (port.readable === null && port.writable === null) {
    return
  }
  try {
    if (port.readable && !port.readable.locked) {
      const reader = port.readable.getReader()
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } catch {
    // Readable may be locked by another consumer (e.g. stuck esptool readLoop).
  }
  try {
    if (port.writable && !port.writable.locked) {
      const writer = port.writable.getWriter()
      await writer.close().catch(() => {})
      writer.releaseLock()
    }
  } catch {
    // ignore
  }
  for (let i = 0; i < 5; i++) {
    if (port.readable === null && port.writable === null) {
      return
    }
    try {
      await port.close()
    } catch {
      // ignore
    }
    await sleepMs(80)
  }
}

async function openSerialPortWithRecovery(port: SerialPort, options: SerialOptions): Promise<void> {
  try {
    await port.open(options)
  } catch (e) {
    if (!isPortAlreadyOpenError(e)) {
      throw e
    }
    await ensureSerialPortClosed(port)
    await sleepMs(120)
    await port.open(options)
  }
}

export type FlashPhase = "connect" | "detect" | "write"

export type WriteProgressPayload = {
  imageIndex: number
  imageCount: number
  written: number
  total: number
  overallPct: number
}

export async function runEspFlash(options: {
  parts: FlashPart[]
  port: SerialPort
  baud: number
  eraseAll: boolean
  terminal?: EspTerminal
  resetMode?: "default_reset" | "no_reset"
  onPhase?: (phase: FlashPhase) => void
  onWriteProgress?: (p: WriteProgressPayload) => void
}): Promise<void> {
  const {
    parts,
    port,
    baud,
    eraseAll,
    terminal = noopEspTerminal,
    resetMode = "default_reset",
    onPhase,
    onWriteProgress,
  } = options
  if (!("serial" in navigator)) {
    throw new Error("Web Serial is not available (use Chromium on https:// or localhost)")
  }

  await ensureSerialPortClosed(port)

  const transport = new Transport(port)
  const loader = new ESPLoader({
    transport,
    baudrate: baud,
    terminal,
  })

  const fileArray = parts.map(p => ({ data: p.data, address: p.address }))
  const lengths = fileArray.map(f => f.data.byteLength)
  const totalBytes = lengths.reduce((a, b) => a + b, 0)

  onPhase?.("connect")
  await loader.main(resetMode)
  onPhase?.("detect")
  const flashSize = (await loader.detectFlashSize()) as FlashSizeValues

  onPhase?.("write")
  await loader.writeFlash({
    fileArray,
    flashMode: "dio",
    flashFreq: "40m",
    flashSize,
    eraseAll,
    compress: true,
    reportProgress: (i, written, total) => {
      let offset = 0
      for (let j = 0; j < i; j++) offset += lengths[j] ?? 0
      const overallPct = totalBytes > 0 ? Math.min(100, Math.round((100 * (offset + written)) / totalBytes)) : 0
      onWriteProgress?.({
        imageIndex: i,
        imageCount: fileArray.length,
        written,
        total,
        overallPct,
      })
    },
  })

  await loader.after("hard_reset")
  await transport.disconnect()
}

/** Match MeshCore `lib/dfu.js` CDC touch timing (1200 baud → close → wait for re-enumeration). */
const CDC_TOUCH_OPEN_MS = 100
const CDC_TOUCH_AFTER_CLOSE_MS = 1500

/** Classic ESP32/S3 (and many nRF CDC) USB bootloader entry: open port at 1200 baud, then close and wait. */
export async function pulseUsbBootloaderPort(): Promise<void> {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial is not available")
  }
  const port = await navigator.serial.requestPort()
  await ensureSerialPortClosed(port)
  try {
    await openSerialPortWithRecovery(port, { baudRate: 1200 })
    await sleepMs(CDC_TOUCH_OPEN_MS)
  } finally {
    await ensureSerialPortClosed(port)
  }
  await sleepMs(CDC_TOUCH_AFTER_CLOSE_MS)
}
