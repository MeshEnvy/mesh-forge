import YAML from 'yaml'

export interface MeshforgeTagsConfig {
  /** JS regex tested against each tag name. Tags not matching are hidden. */
  include?: string
}

export interface MeshforgeTargetsConfig {
  /** JS regex tested against each env name. Non-matching envs are hidden. */
  include?: string
  /**
   * Template string that becomes a regex after substituting captures from the tag matched
   * against tags.include. Supported placeholders: ${captureName}, ${captureName_snake},
   * ${captureName_camel}, ${captureName_pascal}, ${1}, ${2}, …
   * Each substituted segment is regex-escaped before insertion.
   * When the current tag matches tags.include and this field is set, the expanded pattern
   * replaces targets.include for filtering. Falls back to targets.include when the tag
   * does not match or this field is absent.
   */
  include_template?: string
  /** AND-filter: every listed capability must be present on the env (e.g. ["wifi"]). */
  require_capabilities?: string[]
}

/** Per-platform overlay (submodule name → profile fragment). */
export interface MeshforgePlatformFragment {
  tags?: MeshforgeTagsConfig
  targets?: MeshforgeTargetsConfig
  /** Same semantics as meshforge root `require_capabilities`; merged into effective targets filter. */
  require_capabilities?: string[]
}

export interface MeshforgeConfig {
  tags?: MeshforgeTagsConfig
  targets?: MeshforgeTargetsConfig
  /** MeshForge root-level capability filter (merged into effective `targets.require_capabilities`). */
  require_capabilities?: string[]
  /** Submodule directory names → overlay merged on top of root when that platform is selected. */
  platforms?: Record<string, MeshforgePlatformFragment>
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function readTags(obj: Record<string, unknown>): MeshforgeTagsConfig | undefined {
  const t = obj.tags
  if (!isRecord(t)) return undefined
  const tags: MeshforgeTagsConfig = {}
  if (typeof t.include === 'string') tags.include = t.include
  return Object.keys(tags).length ? tags : undefined
}

function readTargets(obj: Record<string, unknown>): MeshforgeTargetsConfig | undefined {
  const t = obj.targets
  if (!isRecord(t)) return undefined
  const targets: MeshforgeTargetsConfig = {}
  if (typeof t.include === 'string') targets.include = t.include
  if (typeof t.include_template === 'string') targets.include_template = t.include_template
  if (Array.isArray(t.require_capabilities)) {
    const caps = t.require_capabilities.filter((c): c is string => typeof c === 'string')
    if (caps.length) targets.require_capabilities = caps
  }
  return Object.keys(targets).length ? targets : undefined
}

function readPlatformFragment(obj: Record<string, unknown>): MeshforgePlatformFragment {
  const frag: MeshforgePlatformFragment = {}
  const tags = readTags(obj)
  const targets = readTargets(obj)
  if (tags) frag.tags = tags
  if (targets) frag.targets = targets
  if (Array.isArray(obj.require_capabilities)) {
    const caps = obj.require_capabilities.filter((c): c is string => typeof c === 'string')
    if (caps.length) frag.require_capabilities = caps
  }
  return frag
}

/**
 * Parse meshforge.yaml using a real YAML parser (nested `platforms:` and root keys).
 */
export function parseMeshforgeYaml(raw: string): MeshforgeConfig | null {
  let doc: unknown
  try {
    doc = YAML.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(doc)) return null
  const mf = doc.meshforge
  if (!isRecord(mf)) return null

  const config: MeshforgeConfig = {}
  const tags = readTags(mf)
  const targets = readTargets(mf)
  if (tags) config.tags = tags
  if (targets) config.targets = targets

  if (Array.isArray(mf.require_capabilities)) {
    const caps = mf.require_capabilities.filter((c): c is string => typeof c === 'string')
    if (caps.length) config.require_capabilities = caps
  }

  if (isRecord(mf.platforms)) {
    const platforms: Record<string, MeshforgePlatformFragment> = {}
    for (const [name, fragRaw] of Object.entries(mf.platforms)) {
      const key = name.trim()
      if (!key) continue
      if (fragRaw === null || fragRaw === undefined) {
        platforms[key] = {}
      } else if (isRecord(fragRaw)) {
        platforms[key] = readPlatformFragment(fragRaw)
      }
    }
    if (Object.keys(platforms).length) config.platforms = platforms
  }

  if (!config.tags && !config.targets && !config.platforms && !config.require_capabilities) return null
  return config
}

function rootCapabilityUnion(config: MeshforgeConfig): string[] {
  const a = config.targets?.require_capabilities ?? []
  const b = config.require_capabilities ?? []
  return [...new Set([...a, ...b])]
}

/** Sorted submodule / platform keys from `meshforge.platforms`. */
export function meshforgePlatformKeys(config: MeshforgeConfig | null | undefined): string[] {
  if (!config?.platforms) return []
  return Object.keys(config.platforms)
    .map(k => k.trim())
    .filter(Boolean)
    .sort((x, y) => x.localeCompare(y))
}

/**
 * Root meshforge plus optional platform overlay (for tag/target filtering in UI and CI context).
 * Strips `platforms` from the result — callers use {@link meshforgePlatformKeys} for the menu.
 */
export function mergeEffectiveMeshforgeConfig(
  config: MeshforgeConfig | null,
  platformKey: string | null
): MeshforgeConfig | null {
  if (!config) return null
  const baseCaps = rootCapabilityUnion(config)
  const stripPlatforms = (): MeshforgeConfig => {
    const { platforms: _p, ...rest } = config
    const out: MeshforgeConfig = { ...rest }
    if (baseCaps.length) {
      out.targets = { ...out.targets, require_capabilities: baseCaps }
    }
    return out
  }

  if (!platformKey || !config.platforms?.[platformKey]) {
    return stripPlatforms()
  }

  const frag = config.platforms[platformKey]
  const fragCaps = [...(frag.targets?.require_capabilities ?? []), ...(frag.require_capabilities ?? [])]
  const mergedCaps = [...new Set([...baseCaps, ...fragCaps])]

  return {
    tags: { ...config.tags, ...frag.tags },
    targets: {
      ...config.targets,
      ...frag.targets,
      ...(mergedCaps.length ? { require_capabilities: mergedCaps } : {}),
    },
  }
}
