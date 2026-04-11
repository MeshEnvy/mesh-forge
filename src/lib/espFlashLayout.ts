import {
  findInTar,
  parseFlashManifest,
  type FlashManifest,
  type FlashManifestSection,
} from './untarGz'

export type FlashPart = { data: Uint8Array; address: number; name: string }

export type BuildFlashPlan = {
  parts: FlashPart[]
  eraseAll: boolean
}

export type BuildFlashPartsOptions = {
  /**
   * When true, use manifest `factory` section (chip erase + merged factory + OTA + filesystem).
   * When false, use `update` section or legacy flat `images`.
   */
  factoryInstall?: boolean
  /**
   * Legacy: when an image has optional:true (e.g. LittleFS), skip unless true.
   * Ignored for Meshtastic dual manifests (update has no optional rows).
   */
  resetDeviceStorage?: boolean
}

function sortFlashParts(parts: FlashPart[]): FlashPart[] {
  return [...parts].sort((a, b) => a.address - b.address)
}

function tarBasename(path: string): string {
  const parts = path.replace(/^\.\//, '').split('/')
  return parts[parts.length - 1] ?? path
}

function isLittlefsManifestFile(file: string): boolean {
  const base = tarBasename(file)
  return base.toLowerCase().startsWith('littlefs-') && base.toLowerCase().endsWith('.bin')
}

function activeSection(m: FlashManifest, factoryInstall: boolean): FlashManifestSection | null {
  if (factoryInstall) {
    const f = m.factory
    if (f && Array.isArray(f.images) && f.images.length > 0) return f
    return null
  }
  const u = m.update
  if (u && Array.isArray(u.images) && u.images.length > 0) return u
  if (Array.isArray(m.images) && m.images.length > 0) {
    return { images: m.images, eraseFlash: m.eraseFlash }
  }
  return null
}

/**
 * PlatformIO projects (e.g. Meshtastic) often emit versioned names like
 * firmware-heltec-v3-2.7.20.bin (split app image; merged factory.bin is not bundled for USB flash).
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

  const app = list.find(
    e => /^firmware-.+\.bin$/i.test(e.base) && !/\.factory\.bin$/i.test(e.base)
  )
  if (app) return { data: app.data, name: app.base }

  return undefined
}

/** Build ordered flash parts + erase policy from a flat map (tar paths or bare filenames → bytes). */
export function buildFlashParts(
  files: Map<string, Uint8Array>,
  options: BuildFlashPartsOptions = {}
): BuildFlashPlan | null {
  const resetDeviceStorage = options.resetDeviceStorage ?? false
  const factoryInstall = options.factoryInstall ?? false

  const manifestRaw = findInTar(files, 'flash-manifest.json')
  if (manifestRaw) {
    const text = new TextDecoder().decode(manifestRaw)
    const m = parseFlashManifest(text)
    if (m) {
      const section = activeSection(m, factoryInstall)
      if (!section) return null
      const out: FlashPart[] = []
      for (const img of section.images) {
        if (img.optional === true && isLittlefsManifestFile(img.file) && !resetDeviceStorage) continue
        const data = findInTar(files, img.file)
        if (!data) return null
        const addr = typeof img.offset === 'string' ? parseInt(img.offset, 0) : Number(img.offset)
        if (!Number.isFinite(addr)) return null
        out.push({ data, address: addr, name: img.file })
      }
      if (out.length) {
        return {
          parts: sortFlashParts(out),
          eraseAll: Boolean(section.eraseFlash),
        }
      }
    }
  }

  const bootloader = findInTar(files, 'bootloader.bin')
  const partitions = findInTar(files, 'partitions.bin')
  const bootApp0 = findInTar(files, 'boot_app0.bin')
  const firmwareExact = findInTar(files, 'firmware.bin')
  const versioned = resolveVersionedFirmwareApp(files)

  let app: Uint8Array | undefined
  let appName: string | undefined
  if (firmwareExact) {
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
    return { parts: sortFlashParts(arr), eraseAll: false }
  }

  if (app && appName && !bootloader && !partitions) {
    return { parts: [{ data: app, address: 0x0, name: appName }], eraseAll: false }
  }

  return null
}

export function manifestFromMap(
  files: Map<string, Uint8Array>,
  manifestFile = 'flash-manifest.json'
): FlashManifest | null {
  const raw = findInTar(files, manifestFile)
  if (!raw) return null
  return parseFlashManifest(new TextDecoder().decode(raw))
}

/** True if manifest includes a factory (erase + merged image) section with images. */
export function manifestHasFactorySection(m: FlashManifest | null): boolean {
  return Boolean(m?.factory?.images && m.factory.images.length > 0)
}
