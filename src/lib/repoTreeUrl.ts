/**
 * Mesh Forge tree URLs: `/owner/repo/tree/<tag-or-ref segments>/target/<env>`
 * Source ref may contain `/` (nested tags are rare but allowed). `target` is a reserved final segment pair.
 */
const TARGET_TAIL = /\/target\/([^/]+)$/

export function parseTreeSplat(treePath: string | undefined): {
  sourceRef: string | null
  targetEnv: string | null
} {
  if (!treePath?.trim()) return { sourceRef: null, targetEnv: null }
  const segments = treePath.split("/").filter(Boolean)
  if (segments.length === 0) return { sourceRef: null, targetEnv: null }
  const joined = segments.map(s => decodeURIComponent(s)).join("/")
  const m = TARGET_TAIL.exec(joined)
  if (!m) return { sourceRef: joined, targetEnv: null }
  const sourceRef = joined.slice(0, m.index).replace(/\/$/, "") || null
  const targetEnv = m[1] ? decodeURIComponent(m[1]) : null
  return { sourceRef, targetEnv }
}

/** Path after `/tree/` (no leading slash). Empty string means no ref — short `/owner/repo` redirects to latest tag. */
export function buildTreeSplatPath(sourceRef: string | null, targetEnv: string | null): string {
  const b = sourceRef?.trim()
  if (!b) return ""
  const enc = b
    .split("/")
    .map(s => encodeURIComponent(s))
    .join("/")
  const t = targetEnv?.trim()
  if (!t) return enc
  return `${enc}/target/${encodeURIComponent(t)}`
}
