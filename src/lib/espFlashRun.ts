import { ESPLoader, Transport, type FlashSizeValues } from 'esptool-js'
import type { FlashPart } from './espFlashLayout'

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
  if (e instanceof DOMException && e.name === 'NotFoundError') return true
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('No port selected')
}

export type FlashPhase = 'connect' | 'detect' | 'write'

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
  resetMode?: 'default_reset' | 'no_reset'
  onPhase?: (phase: FlashPhase) => void
  onWriteProgress?: (p: WriteProgressPayload) => void
}): Promise<void> {
  const {
    parts,
    port,
    baud,
    eraseAll,
    terminal = noopEspTerminal,
    resetMode = 'default_reset',
    onPhase,
    onWriteProgress,
  } = options
  if (!('serial' in navigator)) {
    throw new Error('Web Serial is not available (use Chromium on https:// or localhost)')
  }

  const transport = new Transport(port)
  const loader = new ESPLoader({
    transport,
    baudrate: baud,
    terminal,
  })

  const fileArray = parts.map(p => ({ data: p.data, address: p.address }))
  const lengths = fileArray.map(f => f.data.byteLength)
  const totalBytes = lengths.reduce((a, b) => a + b, 0)

  onPhase?.('connect')
  await loader.main(resetMode)
  onPhase?.('detect')
  const flashSize = (await loader.detectFlashSize()) as FlashSizeValues

  onPhase?.('write')
  await loader.writeFlash({
    fileArray,
    flashMode: 'dio',
    flashFreq: '40m',
    flashSize,
    eraseAll,
    compress: true,
    reportProgress: (i, written, total) => {
      let offset = 0
      for (let j = 0; j < i; j++) offset += lengths[j] ?? 0
      const overallPct =
        totalBytes > 0 ? Math.min(100, Math.round((100 * (offset + written)) / totalBytes)) : 0
      onWriteProgress?.({
        imageIndex: i,
        imageCount: fileArray.length,
        written,
        total,
        overallPct,
      })
    },
  })

  await loader.after('hard_reset')
  await transport.disconnect()
}

/** Classic ESP32/S3 USB CDC bootloader entry: open port at 1200 baud briefly. */
export async function pulseUsbBootloaderPort(): Promise<void> {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial is not available')
  }
  const port = await navigator.serial.requestPort()
  try {
    await port.open({ baudRate: 1200 })
    await new Promise<void>(resolve => setTimeout(resolve, 200))
  } finally {
    try {
      await port.close()
    } catch {
      // ignore
    }
  }
}
