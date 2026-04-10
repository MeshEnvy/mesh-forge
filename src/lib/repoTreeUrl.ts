/**
 * Mesh Forge tree URLs: `/owner/repo/tree/<tag-or-ref segments>/target/<env>` with optional `/flash` for the flasher-only view.
 * Source ref may contain `/` (nested tags are rare but allowed). `target` is a reserved final segment pair.
 */
const TARGET_TAIL = /\/target\/([^/]+)$/
const FLASH_AFTER_TARGET = /\/target\/[^/]+\/flash$/

export function parseTreeSplat(treePath: string | undefined): {
  sourceRef: string | null
  targetEnv: string | null
  flash: boolean
} {
  if (!treePath?.trim()) return { sourceRef: null, targetEnv: null, flash: false }
  const segments = treePath.split("/").filter(Boolean)
  if (segments.length === 0) return { sourceRef: null, targetEnv: null, flash: false }
  let joined = segments.map(s => decodeURIComponent(s)).join("/")
  let flash = false
  if (FLASH_AFTER_TARGET.test(joined)) {
    flash = true
    joined = joined.slice(0, -"/flash".length)
  }
  const m = TARGET_TAIL.exec(joined)
  if (!m) return { sourceRef: joined, targetEnv: null, flash }
  const sourceRef = joined.slice(0, m.index).replace(/\/$/, "") || null
  const targetEnv = m[1] ? decodeURIComponent(m[1]) : null
  return { sourceRef, targetEnv, flash }
}

/** Path after `/tree/` (no leading slash). Empty string means no ref — short `/owner/repo` redirects to latest tag. */
export function buildTreeSplatPath(
  sourceRef: string | null,
  targetEnv: string | null,
  opts?: { flash?: boolean }
): string {
  const b = sourceRef?.trim()
  if (!b) return ""
  const enc = b
    .split("/")
    .map(s => encodeURIComponent(s))
    .join("/")
  const t = targetEnv?.trim()
  if (!t) return enc
  const base = `${enc}/target/${encodeURIComponent(t)}`
  if (opts?.flash) return `${base}/flash`
  return base
}
