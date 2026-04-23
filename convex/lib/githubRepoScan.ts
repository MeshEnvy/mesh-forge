import { githubRepoFromRemote, parseGitmodulesPathToUrl } from './githubSubmodule'
import { unzipSync } from 'fflate'
import type { VirtualFileMap } from './platformioScan'

const GITHUB_API = 'https://api.github.com'

type TreeEntry = {
  path?: string
  mode?: string
  type?: string
  sha?: string
  size?: number
}

type TreeResponse = {
  tree?: TreeEntry[]
  truncated?: boolean
}

type SubmodulePointer = {
  path: string
  owner: string
  repo: string
  commitSha: string
}

function jsonHeaders(headers: Record<string, string>): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...headers,
  }
}

async function fetchTreeRecursive(args: {
  owner: string
  repo: string
  commitSha: string
  headers: Record<string, string>
}): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const url = `${GITHUB_API}/repos/${args.owner}/${args.repo}/git/trees/${args.commitSha}?recursive=1`
  const res = await fetch(url, { headers: jsonHeaders(args.headers) })
  if (!res.ok) {
    throw new Error(
      `github tree ${args.owner}/${args.repo}@${args.commitSha}: ${res.status} ${await res.text()}`
    )
  }
  const j = (await res.json()) as TreeResponse
  return { entries: j.tree ?? [], truncated: Boolean(j.truncated) }
}

async function fetchRepoZipArchive(args: {
  owner: string
  repo: string
  commitSha: string
  headers: Record<string, string>
}): Promise<ArrayBuffer> {
  const url = `${GITHUB_API}/repos/${args.owner}/${args.repo}/zipball/${args.commitSha}`
  const res = await fetch(url, { headers: jsonHeaders(args.headers) })
  if (!res.ok) {
    throw new Error(
      `github zip ${args.owner}/${args.repo}@${args.commitSha}: ${res.status} ${await res.text()}`
    )
  }
  return await res.arrayBuffer()
}

async function fetchBlobText(args: {
  owner: string
  repo: string
  sha: string
  headers: Record<string, string>
}): Promise<string> {
  const url = `${GITHUB_API}/repos/${args.owner}/${args.repo}/git/blobs/${args.sha}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
      ...args.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`github blob ${args.owner}/${args.repo}@${args.sha}: ${res.status} ${await res.text()}`)
  }
  return await res.text()
}

function isScanFile(path: string): boolean {
  if (path.endsWith('.ini')) return true
  if (path === 'meshforge.yaml' || path.endsWith('/meshforge.yaml')) return true
  return false
}

function stripZipRoot(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const i = normalized.indexOf('/')
  if (i < 0) return ''
  return normalized.slice(i + 1)
}

function decodeArchiveFiles(zip: ArrayBuffer): VirtualFileMap {
  const map: VirtualFileMap = {}
  const entries = unzipSync(new Uint8Array(zip))
  const decoder = new TextDecoder('utf-8')
  for (const [zipPath, bytes] of Object.entries(entries)) {
    const path = stripZipRoot(zipPath)
    if (!path || path.endsWith('/')) continue
    if (path !== '.gitmodules' && !isScanFile(path)) continue
    map[path] = decoder.decode(bytes)
  }
  return map
}

function shouldFetchSubmodule(path: string, platformRoot: string): boolean {
  const p = path.trim().replace(/\/+$/, '')
  const root = platformRoot.trim().replace(/\/+$/, '')
  if (!root) return true
  if (p === root) return true
  if (p.startsWith(`${root}/`)) return true
  if (root.startsWith(`${p}/`)) return true
  return false
}

function mapLimit<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return Promise.resolve([])
  const max = Math.max(1, Math.min(limit, items.length))
  const out = new Array<R>(items.length)
  let next = 0
  async function runWorker(): Promise<void> {
    while (true) {
      const i = next
      next += 1
      if (i >= items.length) return
      out[i] = await worker(items[i])
    }
  }
  return Promise.all(Array.from({ length: max }, () => runWorker())).then(() => out)
}

async function resolveSubmodulePointers(args: {
  owner: string
  repo: string
  commitSha: string
  headers: Record<string, string>
  gitmodulesText: string
  platformRoot: string
}): Promise<SubmodulePointer[]> {
  const pathToUrl = parseGitmodulesPathToUrl(args.gitmodulesText)
  if (Object.keys(pathToUrl).length === 0) return []
  const { entries, truncated } = await fetchTreeRecursive(args)
  if (truncated) {
    console.warn(`github tree truncated for ${args.owner}/${args.repo}@${args.commitSha}; submodule scan may miss entries`)
  }
  const gitlinkByPath: Record<string, string> = {}
  for (const entry of entries) {
    if (!entry.path || !entry.sha) continue
    if (entry.type === 'commit' && entry.mode === '160000') {
      gitlinkByPath[entry.path] = entry.sha
    }
  }
  const out: SubmodulePointer[] = []
  for (const [path, url] of Object.entries(pathToUrl)) {
    if (!shouldFetchSubmodule(path, args.platformRoot)) continue
    const commitSha = gitlinkByPath[path]
    if (!commitSha) continue
    const gh = githubRepoFromRemote(url)
    if (!gh) continue
    out.push({ path, owner: gh.owner, repo: gh.repo, commitSha })
  }
  return out
}

/**
 * Archive-first scanner:
 * 1) Download root zipball and parse scan files from it.
 * 2) Read `.gitmodules` + root tree gitlinks for pinned submodule SHAs.
 * 3) Download relevant submodule zipballs and merge scan files.
 */
export async function collectScanFilesFromGithubArchives(args: {
  owner: string
  repo: string
  commitSha: string
  headers: Record<string, string>
  platformRoot: string
}): Promise<VirtualFileMap> {
  const rootZip = await fetchRepoZipArchive(args)
  const rootFiles = decodeArchiveFiles(rootZip)
  const out: VirtualFileMap = {}
  for (const [path, content] of Object.entries(rootFiles)) {
    if (isScanFile(path)) out[path] = content
  }
  const gitmodulesText = rootFiles['.gitmodules']
  if (!gitmodulesText) return out

  const pointers = await resolveSubmodulePointers({
    owner: args.owner,
    repo: args.repo,
    commitSha: args.commitSha,
    headers: args.headers,
    gitmodulesText,
    platformRoot: args.platformRoot,
  })
  const archives = await mapLimit(pointers, 4, async p => {
    const zip = await fetchRepoZipArchive({
      owner: p.owner,
      repo: p.repo,
      commitSha: p.commitSha,
      headers: args.headers,
    })
    return { basePath: p.path, files: decodeArchiveFiles(zip) }
  })
  for (const { basePath, files } of archives) {
    for (const [path, content] of Object.entries(files)) {
      if (!isScanFile(path)) continue
      out[`${basePath}/${path}`] = content
    }
  }
  return out
}

/**
 * Walk the GitHub tree for `owner/repo@commitSha` and return all *.ini / meshforge.yaml files
 * (paths relative to this repo root). Recurses into submodules listed in `.gitmodules` —
 * resolving each pinned commit via the parent tree's `type: "commit"` entries, then fetching the
 * submodule's own recursive tree. Pure HTTP — runs in Convex's default V8 runtime (no `"use node"`).
 */
export async function collectScanFilesFromGithub(args: {
  owner: string
  repo: string
  commitSha: string
  headers: Record<string, string>
}): Promise<VirtualFileMap> {
  const { entries, truncated } = await fetchTreeRecursive(args)
  if (truncated) {
    console.warn(
      `github tree truncated for ${args.owner}/${args.repo}@${args.commitSha}; PlatformIO scan may miss files`
    )
  }

  const files: VirtualFileMap = {}
  const submoduleEntries: TreeEntry[] = []
  let gitmodulesText: string | null = null

  for (const entry of entries) {
    if (!entry.path) continue
    if (entry.type === 'commit' && entry.mode === '160000' && entry.sha) {
      submoduleEntries.push(entry)
      continue
    }
    if (entry.type !== 'blob' || !entry.sha) continue
    if (entry.path === '.gitmodules') {
      gitmodulesText = await fetchBlobText({
        owner: args.owner,
        repo: args.repo,
        sha: entry.sha,
        headers: args.headers,
      })
      continue
    }
    if (isScanFile(entry.path)) {
      files[entry.path] = await fetchBlobText({
        owner: args.owner,
        repo: args.repo,
        sha: entry.sha,
        headers: args.headers,
      })
    }
  }

  if (submoduleEntries.length === 0) return files

  const pathToUrl = gitmodulesText ? parseGitmodulesPathToUrl(gitmodulesText) : {}
  for (const sub of submoduleEntries) {
    const url = pathToUrl[sub.path!]
    if (!url) continue
    const gh = githubRepoFromRemote(url)
    if (!gh) continue
    const subFiles = await collectScanFilesFromGithub({
      owner: gh.owner,
      repo: gh.repo,
      commitSha: sub.sha!,
      headers: args.headers,
    })
    for (const [k, v] of Object.entries(subFiles)) {
      files[`${sub.path}/${k}`] = v
    }
  }

  return files
}
