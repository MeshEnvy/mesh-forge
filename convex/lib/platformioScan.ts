/**
 * Parse PlatformIO-style INI content and collect [env:...] section names from file contents.
 * Pure string logic — safe to import from either Convex runtime.
 */

export function parseIniSections(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let current: string | null = null
  let lastKey: string | null = null
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue
    const sec = trimmed.match(/^\[(.+)\]$/)
    if (sec) {
      current = sec[1]
      if (!sections[current]) sections[current] = {}
      lastKey = null
      continue
    }
    if (current && trimmed.includes('=')) {
      const [k, ...rest] = trimmed.split('=')
      const key = k.trim()
      const value = rest.join('=').trim()
      sections[current][key] = value
      lastKey = key
      continue
    }
    // PlatformIO allows multiline values; indented lines continue the previous key.
    if (current && lastKey && /^\s+/.test(line)) {
      const prev = sections[current][lastKey] ?? ''
      sections[current][lastKey] = prev ? `${prev}\n${trimmed}` : trimmed
    }
  }
  return sections
}

export function extractEnvNamesFromSections(sections: Record<string, Record<string, string>>): string[] {
  const names: string[] = []
  for (const name of Object.keys(sections)) {
    const m = name.match(/^env:(.+)$/)
    if (m) names.push(m[1])
  }
  return [...new Set(names)].sort()
}

export type VirtualFileMap = Record<string, string>

/** Aggregate all PlatformIO sections from every .ini file in the virtual file map. */
function aggregateIniSections(files: VirtualFileMap): Record<string, Record<string, string>> {
  const allSections: Record<string, Record<string, string>> = {}
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.ini')) continue
    Object.assign(allSections, parseIniSections(content))
  }
  return allSections
}

/**
 * Resolve the value of a given key for a PlatformIO section, following `extends` chains.
 * Returns null when the key is not found or the chain is circular / broken.
 */
function resolveKey(
  sectionName: string,
  key: string,
  allSections: Record<string, Record<string, string>>,
  visited: Set<string> = new Set()
): string | null {
  if (visited.has(sectionName)) return null
  visited.add(sectionName)
  const sec = allSections[sectionName]
  if (!sec) return null
  if (sec[key] !== undefined) return sec[key]
  const ext = sec['extends']
  if (!ext) return null
  for (const parent of ext.split(',').map(s => s.trim())) {
    const val = resolveKey(parent, key, allSections, new Set(visited))
    if (val !== null) return val
  }
  return null
}

/**
 * Derive capability strings from a platform identifier and optional board name.
 * - espressif32 (any variant, including pioarduino URLs) → wifi, ble
 * - nordicnrf52 → ble
 * - raspberrypi / platform-raspberrypi → wifi + ble only for boards ending in _w / picow
 * - everything else → no capabilities assumed
 */
function capabilitiesFromPlatform(platform: string, board: string): string[] {
  const p = platform.toLowerCase()
  const b = board.toLowerCase()
  if (p.includes('espressif32')) return ['wifi', 'ble']
  if (p.includes('nordicnrf52')) return ['ble']
  if (p.includes('raspberrypi') || p.includes('platform-raspberrypi')) {
    if (b.includes('picow') || b.endsWith('_w')) return ['wifi', 'ble']
  }
  return []
}

/**
 * Detect capabilities for each env by resolving `platform` and `board` through the
 * full extends chain across all aggregated ini sections.
 */
export function detectEnvCapabilities(
  envNames: string[],
  allSections: Record<string, Record<string, string>>
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const name of envNames) {
    const sectionName = `env:${name}`
    const platform = resolveKey(sectionName, 'platform', allSections) ?? ''
    const board = resolveKey(sectionName, 'board', allSections) ?? ''
    result[name] = capabilitiesFromPlatform(platform, board)
  }
  return result
}

export function collectPlatformioEnvsFromFiles(files: VirtualFileMap): {
  envNames: string[]
  grouped: { flat: string[] }
  envCapabilities: Record<string, string[]>
} {
  const allSections = aggregateIniSections(files)
  const envNames = extractEnvNamesFromSections(allSections)
  const envCapabilities = detectEnvCapabilities(envNames, allSections)
  return { envNames, grouped: { flat: envNames }, envCapabilities }
}
