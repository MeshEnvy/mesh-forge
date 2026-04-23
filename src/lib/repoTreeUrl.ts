/**
 * MeshForge tree URLs:
 * `/owner/repo/tree/<ref>/platform/<platform>/target/<env>` (monorepo + submodule PlatformIO root)
 * or legacy `/owner/repo/tree/<ref>/target/<env>`.
 * Optional `/flash` after the target segment for the flasher-only view.
 */
const TARGET_TAIL = /\/target\/([^/]+)$/
const PLATFORM_TAIL = /\/platform\/([^/]+)$/
const FLASH_AFTER_TARGET = /\/target\/[^/]+\/flash$/

export function parseTreeSplat(treePath: string | undefined): {
  sourceRef: string | null
  platformKey: string | null
  targetEnv: string | null
  flash: boolean
} {
  if (!treePath?.trim()) return { sourceRef: null, platformKey: null, targetEnv: null, flash: false }
  const segments = treePath.split("/").filter(Boolean)
  if (segments.length === 0) return { sourceRef: null, platformKey: null, targetEnv: null, flash: false }
  let joined = segments.map(s => decodeURIComponent(s)).join("/")
  let flash = false
  if (FLASH_AFTER_TARGET.test(joined)) {
    flash = true
    joined = joined.slice(0, -"/flash".length)
  }
  const tm = TARGET_TAIL.exec(joined)
  let targetEnv: string | null = null
  if (tm) {
    targetEnv = decodeURIComponent(tm[1])
    joined = joined.slice(0, tm.index)
  }
  const pm = PLATFORM_TAIL.exec(joined)
  let platformKey: string | null = null
  if (pm) {
    platformKey = decodeURIComponent(pm[1])
    joined = joined.slice(0, pm.index)
  }
  const sourceRef = joined.replace(/\/$/, "").trim() || null
  return { sourceRef, platformKey, targetEnv, flash }
}

/** Path after `/tree/` (no leading slash). Empty string means no ref — short `/owner/repo` redirects to latest tag. */
export function buildTreeSplatPath(
  sourceRef: string | null,
  targetEnv: string | null,
  opts?: { flash?: boolean; platform?: string | null }
): string {
  const b = sourceRef?.trim()
  if (!b) return ""
  const enc = b
    .split("/")
    .map(s => encodeURIComponent(s))
    .join("/")
  let mid = enc
  const plat = opts?.platform?.trim()
  if (plat) {
    mid = `${enc}/platform/${encodeURIComponent(plat)}`
  }
  const t = targetEnv?.trim()
  if (!t) {
    return mid
  }
  const base = `${mid}/target/${encodeURIComponent(t)}`
  if (opts?.flash) return `${base}/flash`
  return base
}
