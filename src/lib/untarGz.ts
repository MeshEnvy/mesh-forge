import pako from "pako"

function basenameKey(path: string): string {
  const parts = path.replace(/^\.\//, "").split("/")
  return parts[parts.length - 1] ?? path
}

/** Minimal ustar tar reader after gzip inflate. */
export function extractTarGz(gz: Uint8Array): Map<string, Uint8Array> {
  const tar = pako.inflate(gz)
  const out = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  let off = 0

  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512)
    off += 512

    const name = dec.decode(header.subarray(0, 100)).split("\0")[0].trim()
    if (!name) break

    const typeflag = dec.decode(header.subarray(156, 157))
    const sizeField = dec.decode(header.subarray(124, 136)).split("\0")[0].trim()
    const size = parseInt(sizeField, 8) || 0
    const prefix = dec.decode(header.subarray(345, 500)).split("\0")[0].trim()
    const path = (prefix ? `${prefix}/${name}` : name).replace(/^\.\//, "")

    const pad = (512 - (size % 512)) % 512

    if (typeflag === "0" || typeflag === "\0" || typeflag === "") {
      out.set(path, new Uint8Array(tar.subarray(off, off + size)))
    }

    off += size + pad
  }

  return out
}

export function findInTar(files: Map<string, Uint8Array>, filename: string): Uint8Array | undefined {
  const lower = filename.toLowerCase()
  for (const [k, v] of files) {
    if (basenameKey(k).toLowerCase() === lower) return v
  }
  return undefined
}

export type FlashManifestImage = {
  file: string
  offset: number | string
  /** When true on LittleFS rows, Mesh Forge skips unless optional handling passes (legacy flat manifests). */
  optional?: boolean
  role?: string
}

/** One flash plan (update or factory) inside flash-manifest.json. */
export type FlashManifestSection = {
  images: FlashManifestImage[]
  /** When true, flasher performs full chip erase before write. */
  eraseFlash?: boolean
}

/** Coarse MCU family for USB flasher entry + tool selection (from CI / PlatformIO). */
export type FlashTargetFamily = "esp32" | "esp8266" | "nrf52" | "rp2040" | "unknown"

/**
 * Root flash-manifest.json: Meshtastic-style `update` + optional `factory`, or legacy flat `images`.
 */
export type FlashManifest = {
  update?: FlashManifestSection
  factory?: FlashManifestSection
  /** Legacy single-layout manifest. */
  images?: FlashManifestImage[]
  eraseFlash?: boolean
  targetFamily?: FlashTargetFamily
  platform?: string
  board?: string
}

export function parseFlashManifest(json: string): FlashManifest | null {
  try {
    const o = JSON.parse(json) as FlashManifest
    if (!o || typeof o !== "object") return null
    if (o.update && Array.isArray(o.update.images) && o.update.images.length > 0) return o
    if (o.factory && Array.isArray(o.factory.images) && o.factory.images.length > 0) return o
    if (Array.isArray(o.images) && o.images.length > 0) return o
    return null
  } catch {
    return null
  }
}
