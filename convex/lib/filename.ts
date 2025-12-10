/**
 * Artifact type enumeration.
 * Safe to import in client-side code.
 */
export enum ArtifactType {
  Firmware = "firmware",
  Source = "source",
}

/**
 * Generates the artifact filename base (without extension) matching the download filename format.
 * Format: meshtastic-{version}-{target}-{last4hash}-{jobId}-{artifactType}
 * This is the canonical implementation used by both Convex backend and frontend.
 *
 * @param version - The firmware version
 * @param target - The target board name
 * @param buildHash - The build hash (used to get last 4 characters)
 * @param githubRunId - The GitHub Actions run ID (optional, but required for actual downloads)
 * @param artifactType - Either "source" or "firmware"
 * @returns The filename base without extension (e.g., "meshtastic-v2.7.16-tbeam-a1b2-1234567890-source")
 */
export function getArtifactFilenameBase(
  version: string,
  target: string,
  buildHash: string,
  githubRunId: number | undefined,
  artifactType: "source" | "firmware"
): string {
  const os = "meshtastic"
  const last4Hash = buildHash.slice(-4)

  if (!githubRunId) {
    // If no githubRunId, fallback format (for builds that haven't completed yet)
    return `${os}-${version}-${target}-${last4Hash}-${artifactType}`
  }

  return `${os}-${version}-${target}-${last4Hash}-${githubRunId}-${artifactType}`
}

/**
 * Generates a build identifier for use in external systems (e.g., Giscus discussions).
 * Format: {target}-{version}-{last4hash} or {target}-{version}-{last4hash}-{plugins}
 * This is a simpler identifier without OS prefix, job ID, or artifact type.
 *
 * @param version - The firmware version
 * @param target - The target board name
 * @param buildHash - The build hash (used to get last 4 characters)
 * @param pluginsEnabled - Optional array of enabled plugin slugs
 * @returns The build identifier (e.g., "tbeam-v2.7.16-a1b2" or "tbeam-v2.7.16-a1b2-plugin1+plugin2")
 */
export function getBuildIdentifier(
  version: string,
  target: string,
  buildHash: string,
  pluginsEnabled?: string[]
): string {
  const last4Hash = buildHash.slice(-4)
  let identifier = `${target}-${version}-${last4Hash}`

  if (pluginsEnabled && pluginsEnabled.length > 0) {
    const sortedPlugins = [...pluginsEnabled].sort()
    const pluginsStr = sortedPlugins.join("+")
    identifier = `${identifier}-${pluginsStr}`
  }

  return identifier
}
