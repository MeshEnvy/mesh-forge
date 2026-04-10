/**
 * Mesh Forge tree URLs: `/owner/repo/tree/<branch segments>/target/<env>`
 * Branch ref may contain `/`; `target` is a reserved final segment pair.
 */
const TARGET_TAIL = /\/target\/([^/]+)$/

export function parseTreeSplat(treePath: string | undefined): {
  branchRef: string | null
  targetEnv: string | null
} {
  if (!treePath?.trim()) return { branchRef: null, targetEnv: null }
  const segments = treePath.split('/').filter(Boolean)
  if (segments.length === 0) return { branchRef: null, targetEnv: null }
  const joined = segments.map(s => decodeURIComponent(s)).join('/')
  const m = TARGET_TAIL.exec(joined)
  if (!m) return { branchRef: joined, targetEnv: null }
  const branchRef = joined.slice(0, m.index).replace(/\/$/, '') || null
  const targetEnv = m[1] ? decodeURIComponent(m[1]) : null
  return { branchRef, targetEnv }
}

/** Path after `/tree/` (no leading slash). Empty string means no branch — use short repo URL. */
export function buildTreeSplatPath(branchRef: string | null, targetEnv: string | null): string {
  const b = branchRef?.trim()
  if (!b) return ''
  const enc = b.split('/').map(s => encodeURIComponent(s)).join('/')
  const t = targetEnv?.trim()
  if (!t) return enc
  return `${enc}/target/${encodeURIComponent(t)}`
}
