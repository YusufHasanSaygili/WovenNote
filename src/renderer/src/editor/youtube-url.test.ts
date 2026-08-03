import { describe, expect, it } from 'vitest'

import { parseYouTubeVideoUrl, youtubeEmbedUrl, youtubeWatchUrl } from './youtube-url'

describe('YouTube URL normalization', () => {
  it.each([
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'youtube.com/shorts/M7lc1UVf-VE',
    'https://m.youtube.com/live/M7lc1UVf-VE?feature=share',
    'https://youtu.be/M7lc1UVf-VE?t=30',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  ])('extracts a strict video id from %s', (url) => {
    expect(parseYouTubeVideoUrl(url)).toEqual({ videoId: 'M7lc1UVf-VE' })
  })

  it.each([
    'https://example.com/watch?v=M7lc1UVf-VE',
    'https://youtube.com.evil.example/watch?v=M7lc1UVf-VE',
    'https://user:secret@youtube.com/watch?v=M7lc1UVf-VE',
    'javascript:alert(1)',
    'https://youtube.com/playlist?list=M7lc1UVf-VE',
    'https://youtube.com/watch?v=too-short',
  ])('rejects non-video or unsafe input %s', (url) => {
    expect(parseYouTubeVideoUrl(url)).toBeNull()
  })

  it('creates fixed HTTPS watch and privacy-enhanced embed URLs', () => {
    expect(youtubeWatchUrl('M7lc1UVf-VE')).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE')
    expect(youtubeEmbedUrl('M7lc1UVf-VE')).toBe(
      'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1&rel=0&origin=https%3A%2F%2Fwovennote.local',
    )
    expect(youtubeEmbedUrl('../unsafe')).toBeNull()
  })
})
