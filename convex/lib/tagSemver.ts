import semver from "semver"

export type TagEntry = { name: string; sha: string }

/**
 * Canonical SemVer string for sorting, or null if the tag is not SemVer-shaped.
 * Normalizes leading `v`/`V` (only when followed by a digit) and `=` so `v1.0.0`,
 * `V1.0.0`, and `1.0.0` share one ordering key. Uses loose parse for real-world tags.
 */
export function semverSortKey(tagName: string): string | null {
  const trimmed = tagName.trim()
  const normalized = trimmed.replace(/^=+/, "").replace(/^[vV](?=\d)/, "")
  const parsed =
    semver.parse(normalized, { loose: true }) ??
    semver.parse(trimmed.replace(/^=+/, ""), { loose: true }) ??
    semver.parse(trimmed, { loose: true })
  return parsed ? parsed.version : null
}

/** SemVer-descending (prereleases included), tie-break by tag name; non-SemVer last, reverse lex. */
export function sortTagNames(tagNames: readonly string[]): string[] {
  const semverRows: { name: string; ver: string }[] = []
  const other: string[] = []
  for (const name of tagNames) {
    const ver = semverSortKey(name)
    if (ver) semverRows.push({ name, ver })
    else other.push(name)
  }
  semverRows.sort((a, b) => {
    const c = semver.rcompare(a.ver, b.ver)
    if (c !== 0) return c
    return b.name.localeCompare(a.name)
  })
  other.sort((a, b) => b.localeCompare(a))
  return [...semverRows.map(r => r.name), ...other]
}

export function sortTagEntries(tags: readonly TagEntry[]): TagEntry[] {
  const byName = new Map<string, TagEntry>()
  for (const t of tags) {
    if (!byName.has(t.name)) byName.set(t.name, t)
  }
  const orderedNames = sortTagNames([...byName.keys()])
  return orderedNames.map(name => byName.get(name)!)
}
