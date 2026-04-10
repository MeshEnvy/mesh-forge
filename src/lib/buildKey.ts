export function normalizeBuildKey(resolvedSourceSha: string, targetEnv: string): string {
  const t = targetEnv.replace(/\//g, '_')
  return `${resolvedSourceSha}_${t}`
}
