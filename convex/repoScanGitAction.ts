import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { collectScanFilesFromGithub, collectScanFilesFromGithubArchives } from './lib/githubRepoScan'
import { parseMeshforgeYaml } from './lib/meshforgeYaml'
import { collectPlatformioEnvsFromFiles, type VirtualFileMap } from './lib/platformioScan'

function githubHeaders(token: string | undefined): Record<string, string> {
  const h: Record<string, string> = {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function scopeFiles(files: VirtualFileMap, platformRoot: string): VirtualFileMap {
  if (!platformRoot) return files
  const prefix = `${platformRoot}/`
  const out: VirtualFileMap = {}
  for (const [k, v] of Object.entries(files)) {
    if (!k.startsWith(prefix)) continue
    out[k.slice(prefix.length)] = v
  }
  return out
}

/**
 * Walk the GitHub tree (recursing into submodules) and scan `*.ini` for PlatformIO envs.
 * Runs in Convex's default V8 runtime — no git binary, no disk, no `"use node"`.
 */
export const runArchiveScan = action({
  args: {
    scanId: v.id('repoRefScan'),
    owner: v.string(),
    repo: v.string(),
    ref: v.string(),
    resolvedSourceSha: v.string(),
    platformRoot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const headers = githubHeaders(process.env.GITHUB_TOKEN)
    const platformRoot = (args.platformRoot ?? '').trim()

    try {
      let allFiles: VirtualFileMap
      try {
        allFiles = await collectScanFilesFromGithubArchives({
          owner: args.owner,
          repo: args.repo,
          commitSha: args.resolvedSourceSha,
          headers,
          platformRoot,
        })
      } catch (archiveError) {
        console.warn(
          `archive scan path failed for ${args.owner}/${args.repo}@${args.resolvedSourceSha}; falling back to tree/blob scan`,
          archiveError
        )
        allFiles = await collectScanFilesFromGithub({
          owner: args.owner,
          repo: args.repo,
          commitSha: args.resolvedSourceSha,
          headers,
        })
      }

      const files = scopeFiles(allFiles, platformRoot)
      const hasAnyIni = Object.keys(files).some(k => k.endsWith('.ini'))
      if (!hasAnyIni) {
        throw new Error(
          platformRoot
            ? `No PlatformIO files under "${platformRoot}" (no *.ini found).`
            : 'No PlatformIO files in repository (no *.ini found).'
        )
      }

      const r = collectPlatformioEnvsFromFiles(files)
      if (r.envNames.length === 0) {
        throw new Error(
          platformRoot
            ? `No PlatformIO environments under "${platformRoot}" (no *.ini env sections found).`
            : 'No PlatformIO environments in repository (no *.ini env sections found).'
        )
      }

      let meshforgeConfig: ReturnType<typeof parseMeshforgeYaml> = null
      const yamlRaw = allFiles['meshforge.yaml']
      if (yamlRaw) {
        try {
          meshforgeConfig = parseMeshforgeYaml(yamlRaw)
        } catch {
          // ignore malformed yaml
        }
      }

      await ctx.runMutation(internal.repoScans.completeScanInternal, {
        scanId: args.scanId,
        envNames: r.envNames,
        grouped: r.grouped,
        envCapabilities: r.envCapabilities,
        meshforgeConfig: meshforgeConfig ?? undefined,
      })
    } catch (e) {
      await ctx.runMutation(internal.repoScans.failScanInternal, {
        scanId: args.scanId,
        message: String(e),
      })
    }
  },
})
