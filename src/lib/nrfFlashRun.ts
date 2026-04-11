import { findInTar } from './untarGz'
import { buildNordicDfuPlan, runNordicDfu } from './nrfDfuRun'

export type NrfFlashPlan = {
  /** Written first when chip erase is requested; causes device to erase all flash and reboot. */
  nukeFile?: Uint8Array
  /** The application UF2 to write after optional nuke. */
  firmwareFile: Uint8Array
  firmwareName: string
}

export type NrfWriteProgressPayload = {
  phase: 'nuke' | 'firmware'
  written: number
  total: number
  pct: number
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  // showDirectoryPicker is present in Chromium but typed as unknown in some TS DOM versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const picker = (window as any).showDirectoryPicker as (() => Promise<FileSystemDirectoryHandle>) | undefined
  if (!picker) throw new Error('File System Access API is not available in this browser. Use Chrome or Edge.')
  return picker.call(window)
}

/**
 * Build an nRF52 UF2 flash plan from the bundle files.
 * Scans for *.uf2 (preferring names starting with "firmware", excluding nuke.uf2).
 * When factoryInstall is true, also includes nuke.uf2 if present in the bundle.
 */
export function buildNrfPlan(
  files: Map<string, Uint8Array>,
  factoryInstall: boolean
): NrfFlashPlan | null {
  let firmwareFile: Uint8Array | undefined
  let firmwareName: string | undefined

  for (const [path, data] of files) {
    const base = path.replace(/^.*\//, '')
    const baseLower = base.toLowerCase()
    if (!baseLower.endsWith('.uf2') || baseLower === 'nuke.uf2') continue
    if (!firmwareName || baseLower.startsWith('firmware')) {
      firmwareName = base
      firmwareFile = data
      if (baseLower.startsWith('firmware')) break
    }
  }

  if (!firmwareFile || !firmwareName) return null

  const nukeFile = factoryInstall ? findInTar(files, 'nuke.uf2') : undefined
  return { firmwareFile, firmwareName, nukeFile }
}

/**
 * Write a single Uint8Array to a file in a directory handle, replacing any existing file.
 */
async function writeToDir(dirHandle: FileSystemDirectoryHandle, filename: string, data: Uint8Array): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    // Slice to a plain ArrayBuffer to satisfy FileSystemWriteChunkType
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    await writable.write(buf)
  } finally {
    await writable.close()
  }
}

/**
 * Flash an nRF52 device via UF2 using the File System Access API.
 *
 * Flow (normal):
 *   1. showDirectoryPicker — user selects the UF2 drive
 *   2. Write firmware.uf2 → device reboots
 *
 * Flow (chip erase / factory):
 *   1. showDirectoryPicker — user selects the UF2 drive
 *   2. Write nuke.uf2 → device erases all flash and re-enters bootloader (~3 s)
 *   3. showDirectoryPicker again — user selects the re-enumerated UF2 drive
 *   4. Write firmware.uf2 → device reboots
 */
async function runUf2Flash(options: {
  plan: NrfFlashPlan
  onPhase: (label: string) => void
  onWriteProgress: (p: NrfWriteProgressPayload) => void
}): Promise<void> {
  const { plan, onPhase, onWriteProgress } = options

  if (plan.nukeFile) {
    onPhase('Select the UF2 drive to erase…')
    const nukeDir = await pickDirectory()

    onPhase('Erasing device flash…')
    onWriteProgress({ phase: 'nuke', written: 0, total: plan.nukeFile.byteLength, pct: 0 })
    await writeToDir(nukeDir, 'nuke.uf2', plan.nukeFile)
    onWriteProgress({ phase: 'nuke', written: plan.nukeFile.byteLength, total: plan.nukeFile.byteLength, pct: 100 })

    // Device erases flash and re-enters UF2 bootloader; drive disappears then reappears.
    onPhase('Waiting for device to re-enumerate…')
    await sleepMs(3500)

    onPhase('Select the UF2 drive again…')
    const fwDir = await pickDirectory()

    onPhase('Writing firmware…')
    onWriteProgress({ phase: 'firmware', written: 0, total: plan.firmwareFile.byteLength, pct: 0 })
    await writeToDir(fwDir, plan.firmwareName, plan.firmwareFile)
    onWriteProgress({ phase: 'firmware', written: plan.firmwareFile.byteLength, total: plan.firmwareFile.byteLength, pct: 100 })
  } else {
    onPhase('Select the UF2 drive that appeared…')
    const dir = await pickDirectory()

    onPhase('Writing firmware…')
    onWriteProgress({ phase: 'firmware', written: 0, total: plan.firmwareFile.byteLength, pct: 0 })
    await writeToDir(dir, plan.firmwareName, plan.firmwareFile)
    onWriteProgress({ phase: 'firmware', written: plan.firmwareFile.byteLength, total: plan.firmwareFile.byteLength, pct: 100 })
  }
}

/**
 * Flash an nRF52 device. Routes to Nordic Serial DFU (seamless, progress bar) when the bundle
 * contains a Nordic DFU package (firmware.bin + firmware.dat), otherwise falls back to UF2
 * via the File System Access API drive picker.
 *
 * The port must have already received the 1200-baud CDC bootloader pulse and be closed.
 */
export async function runNrfFlash(options: {
  port: SerialPort
  files: Map<string, Uint8Array>
  factoryInstall: boolean
  onPhase: (label: string) => void
  onWriteProgress: (p: NrfWriteProgressPayload) => void
}): Promise<void> {
  const { port, files, factoryInstall, onPhase, onWriteProgress } = options

  // Prefer Nordic Serial DFU when the bundle contains a Nordic DFU package (bin + dat).
  const dfuPlan = buildNordicDfuPlan(files)
  if (dfuPlan) {
    await runNordicDfu({
      port,
      plan: dfuPlan,
      eraseAll: factoryInstall,
      onPhase,
      onProgress: pct => onWriteProgress({ phase: 'firmware', written: pct, total: 100, pct }),
    })
    return
  }

  // Fall back to UF2 drive picker (Meshtastic nRF52 and other UF2 bootloader boards).
  const uf2Plan = buildNrfPlan(files, factoryInstall)
  if (!uf2Plan) {
    throw new Error('No flashable firmware found in bundle (expected Nordic DFU .bin/.dat or a .uf2 file)')
  }
  await runUf2Flash({ plan: uf2Plan, onPhase, onWriteProgress })
}

/** True when at least one nRF52 flash method is available in this browser. */
export function isNrfFlashSupported(): boolean {
  // Nordic DFU only needs Web Serial (already checked by caller).
  // UF2 additionally needs File System Access API — but we always try DFU first.
  return true
}
