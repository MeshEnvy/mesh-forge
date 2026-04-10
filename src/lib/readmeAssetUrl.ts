/** Resolve README-relative URLs the same way GitHub does, using the README file's raw download URL as base. */
export function resolveReadmeRelativeUrl(
  hrefOrSrc: string | undefined,
  readmeDownloadUrl: string | null
): string | undefined {
  if (!hrefOrSrc || !readmeDownloadUrl) return hrefOrSrc
  const trimmed = hrefOrSrc.trim()
  if (!trimmed) return hrefOrSrc
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return hrefOrSrc
  if (trimmed.startsWith("//")) return hrefOrSrc
  if (trimmed.startsWith("#")) return hrefOrSrc
  try {
    const download = new URL(readmeDownloadUrl)
    const slash = download.pathname.lastIndexOf("/")
    const dirPath = slash >= 0 ? download.pathname.slice(0, slash + 1) : "/"
    const base = `${download.origin}${dirPath}`
    return new URL(trimmed, base).href
  } catch {
    return hrefOrSrc
  }
}
