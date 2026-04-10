/** Turn noisy Convex / GitHub errors into short copy for the repo build card. */
export function formatBuildErrorSummary(summary: string | undefined): string {
  if (!summary) return ''
  if (summary.includes('Unexpected inputs provided')) {
    return (
      'Mesh Forge’s own GitHub workflow didn’t accept the build request (inputs out of sync). ' +
      'That’s on the Mesh Forge service, not your firmware. Retry won’t help until that workflow YAML is updated.'
    )
  }
  if (summary.length > 600) {
    return `${summary.slice(0, 600)}…`
  }
  return summary
}

/** Short headline + body for people browsing firmware, not operating Mesh Forge. */
export function buildFailurePresentation(summary: string | undefined): {
  headline: string
  body: string
} {
  if (!summary?.trim()) {
    return { headline: 'Build did not finish.', body: '' }
  }
  if (summary.includes('Unexpected inputs provided')) {
    return {
      headline: 'Couldn’t start a cloud build',
      body:
        'Something on the Mesh Forge side didn’t line up with GitHub. It’s not a signal that your repo is broken. ' +
        'Retry usually won’t fix this until the service is updated.',
    }
  }
  if (/GitHub API failed:\s*5\d\d/.test(summary) || /GitHub API failed:\s*429/.test(summary)) {
    return {
      headline: 'GitHub was temporarily unavailable',
      body: 'Starting the build failed because GitHub returned an error or rate limit. Flash again — it often works on a second try.',
    }
  }
  if (/GitHub API failed:\s*4\d\d/.test(summary) && !summary.includes('422')) {
    return {
      headline: 'Couldn’t start the build',
      body: formatBuildErrorSummary(summary),
    }
  }
  if (summary.includes('GitHub API failed: 422')) {
    return {
      headline: 'Couldn’t start the build',
      body: formatBuildErrorSummary(summary),
    }
  }
  return {
    headline: 'Build failed in CI',
    body:
      'Often a compile error, missing PlatformIO dependency, or bad env config in the repo. Fix the project if you can, then use Flash again. ' +
      'Transient CI issues also happen — trying again is safe.',
  }
}
