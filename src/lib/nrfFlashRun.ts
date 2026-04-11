import { findInTar } from './untarGz'
import type { FlashManifest } from './untarGz'

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
 * Build an nRF52 flash plan from the bundle tarball + parsed manifest.
 * Reads the `update` section for a normal flash, or `factory` when factoryInstall is true.
 * Images with role "uf2" are the firmware; role "nuke" is the erase-all UF2.
 *
 * Falls back to scanning the bundle directly for *.uf2 when no manifest is present
 * (covers pre-manifest bundles and builds where emit-flash-manifest.py did not run).
 */
export function buildNrfPlan(
  files: Map<string, Uint8Array>,
  manifest: FlashManifest | null,
  factoryInstall: boolean
): NrfFlashPlan | null {
  const section = factoryInstall ? (manifest?.factory ?? manifest?.update) : manifest?.update

  if (section?.images?.length) {
    let firmwareFile: Uint8Array | undefined
    let firmwareName: string | undefined
    let nukeFile: Uint8Array | undefined

    for (const img of section.images) {
      const role = img.role?.toLowerCase()
      if (role === 'nuke') {
        nukeFile = findInTar(files, img.file)
      } else if (role === 'uf2' || img.file.toLowerCase().endsWith('.uf2')) {
        if (!firmwareFile) {
          firmwareFile = findInTar(files, img.file)
          firmwareName = img.file
        }
      }
    }

    if (firmwareFile && firmwareName) {
      return { firmwareFile, firmwareName, nukeFile }
    }
  }

  // Fallback: scan bundle files directly for *.uf2 (no manifest or manifest had no UF2 images).
  // Prefer names starting with "firmware", exclude nuke.uf2.
  let fallbackName: string | undefined
  let fallbackData: Uint8Array | undefined
  for (const [path, data] of files) {
    const base = path.replace(/^.*\//, '')
    const baseLower = base.toLowerCase()
    if (!baseLower.endsWith('.uf2') || baseLower === 'nuke.uf2') continue
    if (!fallbackName || baseLower.startsWith('firmware')) {
      fallbackName = base
      fallbackData = data
      if (baseLower.startsWith('firmware')) break
    }
  }

  if (!fallbackData || !fallbackName) return null
  return { firmwareFile: fallbackData, firmwareName: fallbackName }
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
export async function runNrfFlash(options: {
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

/** True when the File System Access API directory picker is available (Chromium). */
export function isNrfFlashSupported(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (window as any).showDirectoryPicker === 'function'
}
