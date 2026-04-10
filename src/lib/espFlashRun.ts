import { ESPLoader, Transport } from 'esptool-js'
import type { FlashPart } from './espFlashLayout'

type EspTerminal = {
  clean: () => void
  write: (data: string) => void
  writeLine: (data: string) => void
}

export async function runEspFlash(options: {
  parts: FlashPart[]
  baud: number
  eraseAll: boolean
  terminal: EspTerminal
  resetMode?: 'default_reset' | 'no_reset'
}): Promise<void> {
  const { parts, baud, eraseAll, terminal, resetMode = 'default_reset' } = options
  if (!('serial' in navigator)) {
    throw new Error('Web Serial is not available (use Chromium on https:// or localhost)')
  }

  const port = await navigator.serial.requestPort()
  const transport = new Transport(port)
  const loader = new ESPLoader({
    transport,
    baudrate: baud,
    terminal,
  })

  const fileArray = parts.map(p => ({ data: p.data, address: p.address }))

  await loader.main(resetMode)
  const flashSize = await loader.detectFlashSize()

  await loader.writeFlash({
    fileArray,
    flashMode: 'dio',
    flashFreq: '40m',
    flashSize,
    eraseAll,
    compress: true,
    reportProgress: (i, written, total) => {
      loader.info(`Image ${i + 1}/${fileArray.length}: ${Math.round((100 * written) / total)}%`)
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
