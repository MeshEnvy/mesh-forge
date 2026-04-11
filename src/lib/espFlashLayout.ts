export type FlashPart = { data: Uint8Array; address: number; name: string }

export type BuildFlashPlan = {
  parts: FlashPart[]
  eraseAll: boolean
}

function tarBasename(path: string): string {
  const parts = path.replace(/^\.\//, '').split('/')
  return parts[parts.length - 1] ?? path
}

/**
 * Build the flash plan from a firmware bundle (tar paths or bare filenames → bytes).
 *
 * For ESP32: expects a single merged binary (firmware-*.factory.bin) at address 0x0.
 * PlatformIO's mergebin target handles all chip-specific offsets during the build.
 *
 * For custom firmware drag-and-drop (no manifest): finds any .bin that is not a
 * sub-component and flashes it at 0x0.
 */
export function buildFlashParts(files: Map<string, Uint8Array>): BuildFlashPlan | null {
  for (const [path, data] of files) {
    const base = tarBasename(path)
    const lower = base.toLowerCase()
    if (
      lower.endsWith('.bin') &&
      lower !== 'bootloader.bin' &&
      lower !== 'partitions.bin' &&
      lower !== 'boot_app0.bin'
    ) {
      return { parts: [{ data, address: 0x0, name: base }], eraseAll: false }
    }
  }
  return null
}
