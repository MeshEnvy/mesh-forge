import type { MeshforgeConfig } from '@/convex/lib/meshforgeYaml'

export type { MeshforgeConfig }

/** Escape a string for literal use inside a RegExp pattern. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert a raw string to snake_case.
 * CamelCase boundaries and non-alphanumeric runs become underscores.
 * e.g. "clientRole" → "client_role", "client-role" → "client_role"
 */
export function toSnakeCase(s: string): string {
  return s
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Convert to lowerCamelCase. e.g. "client_role" → "clientRole" */
export function toCamelCase(s: string): string {
  const parts = toSnakeCase(s).split('_').filter(Boolean)
  if (!parts.length) return ''
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

/** Convert to PascalCase. e.g. "client_role" → "ClientRole" */
export function toPascalCase(s: string): string {
  return toSnakeCase(s)
    .split('_')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

/**
 * Build the effective target RegExp given the currently selected tag and profile config.
 *
 * Precedence:
 * 1. targets.include_template — expanded using captures from the tag matched against
 *    tags.include (when the tag matches and the template is set)
 * 2. targets.include — used as a static regex
 * 3. null — no target filter
 *
 * Placeholder syntax in include_template:
 *   ${captureName}         raw value of the named capture group
 *   ${captureName_snake}   snake_case transform
 *   ${captureName_camel}   lowerCamelCase transform
 *   ${captureName_pascal}  PascalCase transform
 *   ${1}, ${2}, …          numbered capture groups
 * Each substituted segment is regex-escaped before insertion.
 */
export function buildTargetRegex(tag: string, config: MeshforgeConfig): RegExp | null {
  const tagsInclude = config.tags?.include
  const template = config.targets?.include_template

  if (template && tagsInclude) {
    let tagMatch: RegExpExecArray | null = null
    try {
      tagMatch = new RegExp(tagsInclude).exec(tag)
    } catch {
      // malformed regex — fall through
    }
    if (tagMatch) {
      const pattern = template.replace(/\$\{([^}]+)\}/g, (_, placeholder: string) => {
        // Numbered capture: ${1}, ${2}, …
        const num = Number(placeholder)
        if (Number.isInteger(num) && num >= 1) {
          return escapeRegex(tagMatch![num] ?? '')
        }

        // Detect trailing case suffix
        let baseName = placeholder
        let suffix: 'snake' | 'camel' | 'pascal' | '' = ''
        if (placeholder.endsWith('_snake')) {
          baseName = placeholder.slice(0, -6)
          suffix = 'snake'
        } else if (placeholder.endsWith('_camel')) {
          baseName = placeholder.slice(0, -6)
          suffix = 'camel'
        } else if (placeholder.endsWith('_pascal')) {
          baseName = placeholder.slice(0, -7)
          suffix = 'pascal'
        }

        const rawCapture = tagMatch!.groups?.[baseName] ?? ''
        let value: string
        if (suffix === 'snake') value = toSnakeCase(rawCapture)
        else if (suffix === 'camel') value = toCamelCase(rawCapture)
        else if (suffix === 'pascal') value = toPascalCase(rawCapture)
        else value = rawCapture
        return escapeRegex(value)
      })
      try {
        return new RegExp(pattern)
      } catch {
        // malformed expanded pattern — fall through
      }
    }
  }

  if (config.targets?.include) {
    try {
      return new RegExp(config.targets.include)
    } catch {
      return null
    }
  }

  return null
}

/** Filter tag list using config.tags.include. Returns full list when no filter is set. */
export function filterTagNames(tags: string[], config: MeshforgeConfig): string[] {
  const inc = config.tags?.include
  if (!inc) return tags
  let rx: RegExp
  try {
    rx = new RegExp(inc)
  } catch {
    return tags
  }
  return tags.filter(t => rx.test(t))
}

/**
 * Filter env names using the effective target regex and capability requirements.
 * Returns full list when no filter is configured.
 *
 * @param envNames   All env names from the scan
 * @param config     Parsed meshforge.yaml (or null → no filtering)
 * @param capabilities  envCapabilities map from the scan
 * @param currentTag Currently selected tag (used for include_template interpolation)
 */
export function filterEnvNames(
  envNames: string[],
  config: MeshforgeConfig | null,
  capabilities: Record<string, string[]>,
  currentTag: string
): string[] {
  if (!config) return envNames
  const rx = buildTargetRegex(currentTag, config)
  const reqCaps = config.targets?.require_capabilities ?? []

  const isFiltering = rx !== null || reqCaps.length > 0
  if (isFiltering) {
    console.debug(
      '[meshforge] filterEnvNames — tag=%o  regex=%o  require_capabilities=%o',
      currentTag,
      rx?.source ?? '(none)',
      reqCaps
    )
  }
  if (
    reqCaps.length > 0 &&
    envNames.length > 0 &&
    envNames.every(n => (capabilities[n]?.length ?? 0) === 0)
  ) {
    console.warn(
      '[meshforge] envCapabilities is empty for every env — this repoRefScan was likely completed before capability scanning shipped. Open the repo again (ensureScan will rescan) or wait for in_progress to finish.'
    )
  }

  return envNames.filter(name => {
    if (rx && !rx.test(name)) {
      console.debug('[meshforge]  ✗ %o  — rejected by regex (%o)', name, rx.source)
      return false
    }
    if (reqCaps.length > 0) {
      const envCaps = capabilities[name] ?? []
      const missing = reqCaps.filter(c => !envCaps.includes(c))
      if (missing.length > 0) {
        console.debug('[meshforge]  ✗ %o  — missing capabilities %o (has %o)', name, missing, envCaps)
        return false
      }
    }
    if (isFiltering) {
      console.debug('[meshforge]  ✓ %o', name)
    }
    return true
  })
}
