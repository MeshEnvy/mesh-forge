/**
 * Parsers for `.gitmodules` and GitHub remote URLs. Pure string logic.
 */

export function parseGitmodulesPathToUrl(gitmodulesText: string): Record<string, string> {
  const map: Record<string, string> = {}
  let pendingPath: string | null = null
  for (const line of gitmodulesText.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    if (t.startsWith('[') && t.endsWith(']')) {
      pendingPath = null
      continue
    }
    const pathM = t.match(/^path\s*=\s*(.+)$/)
    if (pathM) {
      pendingPath = stripQuotes(pathM[1].trim())
      continue
    }
    const urlM = t.match(/^url\s*=\s*(.+)$/)
    if (urlM && pendingPath) {
      map[pendingPath] = stripQuotes(urlM[1].trim())
      pendingPath = null
    }
  }
  return map
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

/** Parse `https://github.com/o/r.git` or `git@github.com:o/r.git` → { owner, repo }. */
export function githubRepoFromRemote(url: string): { owner: string; repo: string } | null {
  const u = url.trim()
  const https = u.match(/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?(?:\/|$)/i)
  if (https) return { owner: https[1], repo: https[2] }
  const ssh = u.match(/git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/i)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  return null
}
