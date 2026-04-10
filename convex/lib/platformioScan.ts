/**
 * Parse PlatformIO-style INI content and collect [env:...] section names from file contents.
 */

export function parseIniSections(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let current: string | null = null
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) continue
    const sec = trimmed.match(/^\[(.+)\]$/)
    if (sec) {
      current = sec[1]
      if (!sections[current]) sections[current] = {}
      continue
    }
    if (current && trimmed.includes("=")) {
      const [k, ...rest] = trimmed.split("=")
      const key = k.trim()
      const value = rest.join("=").trim()
      sections[current][key] = value
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

/** Strip first path segment (GitHub zip root folder). */
export function normalizeZipPaths(files: Record<string, Uint8Array>, decode: (u: Uint8Array) => string): VirtualFileMap {
  const out: VirtualFileMap = {}
  for (const path of Object.keys(files)) {
    const parts = path.split("/").filter(Boolean)
    if (parts.length < 2) continue
    const rel = parts.slice(1).join("/")
    if (!rel.endsWith(".ini")) continue
    try {
      out[rel] = decode(files[path])
    } catch {
      // skip binary
    }
  }
  return out
}

export function collectPlatformioEnvsFromFiles(files: VirtualFileMap): { envNames: string[]; grouped: { flat: string[] } } {
  const allEnvs = new Set<string>()
  for (const content of Object.values(files)) {
    const sections = parseIniSections(content)
    for (const n of extractEnvNamesFromSections(sections)) {
      allEnvs.add(n)
    }
  }
  const envNames = [...allEnvs].sort()
  return { envNames, grouped: { flat: envNames } }
}
