/** Turn noisy Convex / GitHub errors into short copy for the repo build card. */
export function formatBuildErrorSummary(summary: string | undefined): string {
  if (!summary) return ''
  if (summary.includes('Unexpected inputs provided')) {
    return (
      'GitHub Actions rejected this workflow dispatch: the workflow file on the Mesh Forge GitHub repo ' +
      'does not declare the same `workflow_dispatch` inputs as this app (update `custom_build.yml` / ' +
      '`custom_build_test.yml` on `MeshEnvy/mesh-forge` and try again).'
    )
  }
  if (summary.length > 600) {
    return `${summary.slice(0, 600)}…`
  }
  return summary
}
