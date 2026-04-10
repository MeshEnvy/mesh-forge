/** Normalize GitHub repo `homepage` for href and a short label (GitHub About–style). */
export function homepageHref(raw: string): string {
  const t = raw.trim()
  if (!t) return '#'
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export function homepageLabel(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    const u = new URL(homepageHref(t))
    let out = u.hostname.replace(/^www\./i, '')
    if (u.pathname !== '/' && u.pathname !== '') {
      out += u.pathname.replace(/\/$/, '')
    }
    return out
  } catch {
    return t
  }
}
