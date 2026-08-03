export interface YouTubeVideoReference {
  readonly videoId: string
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const STANDARD_HOSTS = new Set([
  'm.youtube.com',
  'music.youtube.com',
  'www.youtube.com',
  'youtube.com',
])
const SHORT_HOSTS = new Set(['www.youtu.be', 'youtu.be'])
const EMBED_HOSTS = new Set(['www.youtube-nocookie.com', 'youtube-nocookie.com'])

export function isYouTubeVideoId(value: string): boolean {
  return YOUTUBE_VIDEO_ID.test(value)
}

export function parseYouTubeVideoUrl(value: string): YouTubeVideoReference | null {
  const candidate = value.trim()
  if (!candidate) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null

  const host = url.hostname.toLowerCase()
  const pathSegments = url.pathname.split('/').filter(Boolean)
  let videoId: string | null = null

  if (SHORT_HOSTS.has(host)) {
    videoId = pathSegments[0] ?? null
  } else if (STANDARD_HOSTS.has(host)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v')
    else if (['embed', 'live', 'shorts'].includes(pathSegments[0] ?? '')) {
      videoId = pathSegments[1] ?? null
    }
  } else if (EMBED_HOSTS.has(host) && pathSegments[0] === 'embed') {
    videoId = pathSegments[1] ?? null
  }

  return videoId && isYouTubeVideoId(videoId) ? { videoId } : null
}

export function youtubeEmbedUrl(videoId: string): string | null {
  if (!isYouTubeVideoId(videoId)) return null
  return `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&origin=https%3A%2F%2Fwovennote.local`
}

export function youtubeWatchUrl(videoId: string): string | null {
  if (!isYouTubeVideoId(videoId)) return null
  return `https://www.youtube.com/watch?v=${videoId}`
}
