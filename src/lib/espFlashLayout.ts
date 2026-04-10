import { findInTar, parseFlashManifest, type FlashManifest } from './untarGz'

export type FlashPart = { data: Uint8Array; address: number; name: string }

export function layoutPreviewFromManifest(m: FlashManifest): string[] {
  return m.images.map(im => `${im.file} @ ${String(im.offset)}`)
}

/** Build ordered flash parts from a flat map (tar paths or bare filenames → bytes). */
export function buildFlashParts(files: Map<string, Uint8Array>): FlashPart[] | null {
  const manifestRaw = findInTar(files, 'flash-manifest.json')
  if (manifestRaw) {
    const text = new TextDecoder().decode(manifestRaw)
    const m = parseFlashManifest(text)
    if (m) {
      const out: FlashPart[] = []
      for (const img of m.images) {
        const data = findInTar(files, img.file)
        if (!data) return null
        const addr = typeof img.offset === 'string' ? parseInt(img.offset, 0) : Number(img.offset)
        if (!Number.isFinite(addr)) return null
        out.push({ data, address: addr, name: img.file })
      }
      if (out.length) return out
    }
  }

  const bootloader = findInTar(files, 'bootloader.bin')
  const partitions = findInTar(files, 'partitions.bin')
  const bootApp0 = findInTar(files, 'boot_app0.bin')
  const factory = findInTar(files, 'firmware.factory.bin')
  const firmware = findInTar(files, 'firmware.bin')

  const app = factory ?? firmware
  if (bootloader && partitions && app) {
    const arr: FlashPart[] = [
      { data: bootloader, address: 0x1000, name: 'bootloader.bin' },
      { data: partitions, address: 0x8000, name: 'partitions.bin' },
      { data: app, address: 0x10000, name: factory ? 'firmware.factory.bin' : 'firmware.bin' },
    ]
    if (bootApp0) arr.push({ data: bootApp0, address: 0xe000, name: 'boot_app0.bin' })
    return arr
  }

  if (app && !bootloader && !partitions) {
    return [{ data: app, address: 0x0, name: factory ? 'firmware.factory.bin' : 'firmware.bin' }]
  }

  return null
}

export function manifestFromMap(files: Map<string, Uint8Array>): FlashManifest | null {
  const raw = findInTar(files, 'flash-manifest.json')
  if (!raw) return null
  return parseFlashManifest(new TextDecoder().decode(raw))
}
