export function normalizeBuildKey(
  resolvedSourceSha: string,
  targetEnv: string,
  platformRoot?: string
): string {
  const p = (platformRoot ?? "").trim().replace(/\//g, "_")
  const t = targetEnv.replace(/\//g, "_")
  if (!p) return `${resolvedSourceSha}_${t}`
  return `${resolvedSourceSha}_${p}_${t}`
}
