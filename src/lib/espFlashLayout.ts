import { findInTar, parseFlashManifest, type FlashManifest } from './untarGz'

export type FlashPart = { data: Uint8Array; address: number; name: string }

export type BuildFlashPartsOptions = {
  /** When false, manifest rows with optional:true are omitted. */
  eraseAll?: boolean
}

function sortFlashParts(parts: FlashPart[]): FlashPart[] {
  return [...parts].sort((a, b) => a.address - b.address)
}

function tarBasename(path: string): string {
  const parts = path.replace(/^\.\//, '').split('/')
  return parts[parts.length - 1] ?? path
}

/**
 * PlatformIO projects (e.g. Meshtastic) often emit versioned names like
 * firmware-heltec-v3-2.7.20.factory.bin instead of firmware.factory.bin.
 */
function resolveVersionedFirmwareApp(
  files: Map<string, Uint8Array>
): { data: Uint8Array; name: string } | undefined {
  type Entry = { base: string; data: Uint8Array }
  const list: Entry[] = []
  for (const [path, data] of files) {
    const base = tarBasename(path)
    const lower = base.toLowerCase()
    if (lower.startsWith('littlefs-')) continue
    if (
      lower === 'bootloader.bin' ||
      lower === 'partitions.bin' ||
      lower === 'boot_app0.bin'
    ) {
      continue
    }
    list.push({ base, data })
  }

  const factory = list.find(e => /^firmware-.+\.factory\.bin$/i.test(e.base))
  if (factory) return { data: factory.data, name: factory.base }

  const app = list.find(
    e => /^firmware-.+\.bin$/i.test(e.base) && !/\.factory\.bin$/i.test(e.base)
  )
  if (app) return { data: app.data, name: app.base }

  return undefined
}

export function layoutPreviewFromManifest(m: FlashManifest): string[] {
  return m.images.map(im => {
    const tag = im.optional ? ' — optional unless full chip erase' : ''
    return `${im.file} @ ${String(im.offset)}${tag}`
  })
}

/** Build ordered flash parts from a flat map (tar paths or bare filenames → bytes). */
export function buildFlashParts(
  files: Map<string, Uint8Array>,
  options: BuildFlashPartsOptions = {}
): FlashPart[] | null {
  const eraseAll = options.eraseAll ?? false

  const manifestRaw = findInTar(files, 'flash-manifest.json')
  if (manifestRaw) {
    const text = new TextDecoder().decode(manifestRaw)
    const m = parseFlashManifest(text)
    if (m) {
      const out: FlashPart[] = []
      for (const img of m.images) {
        if (!eraseAll && img.optional === true) continue
        const data = findInTar(files, img.file)
        if (!data) return null
        const addr = typeof img.offset === 'string' ? parseInt(img.offset, 0) : Number(img.offset)
        if (!Number.isFinite(addr)) return null
        out.push({ data, address: addr, name: img.file })
      }
      if (out.length) return sortFlashParts(out)
    }
  }

  const bootloader = findInTar(files, 'bootloader.bin')
  const partitions = findInTar(files, 'partitions.bin')
  const bootApp0 = findInTar(files, 'boot_app0.bin')
  const factoryExact = findInTar(files, 'firmware.factory.bin')
  const firmwareExact = findInTar(files, 'firmware.bin')
  const versioned = resolveVersionedFirmwareApp(files)

  let app: Uint8Array | undefined
  let appName: string | undefined
  if (factoryExact) {
    app = factoryExact
    appName = 'firmware.factory.bin'
  } else if (firmwareExact) {
    app = firmwareExact
    appName = 'firmware.bin'
  } else if (versioned) {
    app = versioned.data
    appName = versioned.name
  }

  if (bootloader && partitions && app && appName) {
    const arr: FlashPart[] = [
      { data: bootloader, address: 0x1000, name: 'bootloader.bin' },
      { data: partitions, address: 0x8000, name: 'partitions.bin' },
      { data: app, address: 0x10000, name: appName },
    ]
    if (bootApp0) arr.push({ data: bootApp0, address: 0xe000, name: 'boot_app0.bin' })
    return sortFlashParts(arr)
  }

  if (app && appName && !bootloader && !partitions) {
    return [{ data: app, address: 0x0, name: appName }]
  }

  return null
}

export function manifestFromMap(files: Map<string, Uint8Array>): FlashManifest | null {
  const raw = findInTar(files, 'flash-manifest.json')
  if (!raw) return null
  return parseFlashManifest(new TextDecoder().decode(raw))
}
