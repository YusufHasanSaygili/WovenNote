// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { CONTENT_SECURITY_POLICY } from '../shared/security'
import { isTrustedNavigation, youtubeEmbedRequestHeaders } from './security'

describe('isTrustedNavigation', () => {
  it('allows the exact renderer document with a query or fragment', () => {
    expect(
      isTrustedNavigation('http://127.0.0.1:5173/?mode=dev#ready', 'http://127.0.0.1:5173/'),
    ).toBe(true)
  })

  it('denies different paths, origins and malformed URLs', () => {
    const trustedUrl = 'http://127.0.0.1:5173/'

    expect(isTrustedNavigation('http://127.0.0.1:5173/unexpected', trustedUrl)).toBe(false)
    expect(isTrustedNavigation('https://example.com/', trustedUrl)).toBe(false)
    expect(isTrustedNavigation('not a url', trustedUrl)).toBe(false)
  })

  it('rejects executable schemes, credential confusion and a different production file', () => {
    const trustedFile =
      'file:///C:/Program%20Files/WovenNote/resources/app.asar/out/renderer/index.html'

    expect(isTrustedNavigation(`${trustedFile}?mode=release#ready`, trustedFile)).toBe(true)
    expect(isTrustedNavigation('javascript:alert(1)', trustedFile)).toBe(false)
    expect(isTrustedNavigation('data:text/html,<script>alert(1)</script>', trustedFile)).toBe(false)
    expect(
      isTrustedNavigation(
        'file:///C:/Program%20Files/WovenNote/resources/app.asar/out/renderer/other.html',
        trustedFile,
      ),
    ).toBe(false)
    expect(
      isTrustedNavigation('https://trusted.example@attacker.example/', 'https://trusted.example/'),
    ).toBe(false)
  })
})

describe('CONTENT_SECURITY_POLICY', () => {
  it('uses restrictive defaults without unsafe script or style directives', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain('frame-src https://www.youtube-nocookie.com')
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-inline'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'")
    expect(CONTENT_SECURITY_POLICY).not.toContain("'nonce-")
  })
})

describe('youtubeEmbedRequestHeaders', () => {
  it('adds a stable client referrer only to the allowlisted embed path', () => {
    expect(
      youtubeEmbedRequestHeaders(
        'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1',
        { Accept: 'text/html' },
      ),
    ).toEqual({ Accept: 'text/html', Referer: 'https://wovennote.local/' })
    expect(
      youtubeEmbedRequestHeaders('https://attacker.example/embed/M7lc1UVf-VE', {
        Accept: 'text/html',
      }),
    ).toEqual({ Accept: 'text/html' })
    expect(
      youtubeEmbedRequestHeaders('https://www.youtube-nocookie.com.evil.example/embed/id', {}),
    ).toEqual({})
  })
})
