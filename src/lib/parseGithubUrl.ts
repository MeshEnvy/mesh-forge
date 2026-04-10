export type ParsedGithubUrl = { owner: string; repo: string; treePath?: string }

/** Accept pasted browser URLs or `owner/repo` shorthand. */
export function parseGithubUrl(raw: string): ParsedGithubUrl | null {
  const s = raw.trim()
  if (!s) return null

  if (!/^https?:\/\//i.test(s)) {
    const bare = s.split(/[?#]/)[0].replace(/\/$/, '')
    const bm = bare.match(/^([^/]+)\/([^/]+)$/)
    if (bm) {
      return { owner: bm[1], repo: bm[2].replace(/\.git$/, '') }
    }
  }

  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  const noQuery = withScheme.split(/[?#]/)[0].replace(/\/$/, '')

  const gh = noQuery.match(/github\.com\/([^/]+)\/([^/]+)/i)
  if (!gh) return null
  const owner = gh[1]
  const repo = gh[2].replace(/\.git$/, '')

  const lower = noQuery.toLowerCase()
  const treeMarker = '/tree/'
  const idx = lower.indexOf(treeMarker)
  if (idx === -1) return { owner, repo }

  const rest = noQuery.slice(idx + treeMarker.length)
  if (!rest) return { owner, repo }
  return { owner, repo, treePath: rest }
}
