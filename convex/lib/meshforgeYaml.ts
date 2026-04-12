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

export interface MeshforgeConfig {
  tags?: MeshforgeTagsConfig
  targets?: MeshforgeTargetsConfig
}

/**
 * Minimal parser for the meshforge.yaml format. Only the known schema is handled;
 * unknown keys are silently ignored.
 *
 * Supports:
 * - 2-space YAML-like indentation (0 / 2 / 4 spaces)
 * - Quoted ("…" or '…') and unquoted scalar values
 * - Inline flow lists [a, b, c]
 * - Line comments starting with #
 */
export function parseMeshforgeYaml(raw: string): MeshforgeConfig | null {
  const config: MeshforgeConfig = {}
  let inMeshforge = false
  let section: 'tags' | 'targets' | null = null

  for (const rawLine of raw.split(/\r?\n/)) {
    const stripped = rawLine.replace(/#.*$/, '').trimEnd()
    if (!stripped.trim()) continue

    const indent = stripped.length - stripped.trimStart().length
    const content = stripped.trimStart()

    if (indent === 0) {
      inMeshforge = content === 'meshforge:'
      section = null
      continue
    }

    if (!inMeshforge) continue

    if (indent === 2) {
      if (content === 'tags:') {
        section = 'tags'
        if (!config.tags) config.tags = {}
      } else if (content === 'targets:') {
        section = 'targets'
        if (!config.targets) config.targets = {}
      } else {
        section = null
      }
      continue
    }

    if (indent === 4 && section) {
      const kv = content.match(/^(\w+):\s*(.*)$/)
      if (!kv) continue
      const [, key, rawVal] = kv
      if (section === 'tags') {
        if (key === 'include') config.tags!.include = parseScalar(rawVal)
      } else if (section === 'targets') {
        if (key === 'include') config.targets!.include = parseScalar(rawVal)
        else if (key === 'include_template') config.targets!.include_template = parseScalar(rawVal)
        else if (key === 'require_capabilities') config.targets!.require_capabilities = parseInlineList(rawVal)
      }
    }
  }

  if (!config.tags && !config.targets) return null
  return config
}

function parseScalar(raw: string): string {
  const s = raw.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function parseInlineList(raw: string): string[] {
  const s = raw.trim()
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map(p => parseScalar(p.trim()))
      .filter(Boolean)
  }
  return s ? [parseScalar(s)] : []
}
