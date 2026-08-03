export function normalizeEditorLink(value: string): string | null {
  const candidate = value.trim()
  if (!candidate) return null

  if (/^mailto:/i.test(candidate)) {
    return /^mailto:[^\s@]+@[^\s@]+$/i.test(candidate) ? candidate : null
  }

  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
