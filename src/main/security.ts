import type { Session, WebContents } from 'electron'

import { CONTENT_SECURITY_POLICY } from '../shared/security'

const YOUTUBE_CLIENT_ORIGIN = 'https://wovennote.local/'

export function youtubeEmbedRequestHeaders(
  targetUrl: string,
  requestHeaders: Readonly<Record<string, string>>,
): Record<string, string> {
  try {
    const url = new URL(targetUrl)
    if (
      url.protocol === 'https:' &&
      url.hostname === 'www.youtube-nocookie.com' &&
      url.pathname.startsWith('/embed/')
    ) {
      return { ...requestHeaders, Referer: YOUTUBE_CLIENT_ORIGIN }
    }
  } catch {
    // Malformed or unrelated URLs retain their existing request headers.
  }
  return { ...requestHeaders }
}

function normalizedDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.href
  } catch {
    return null
  }
}

export function isTrustedNavigation(targetUrl: string, trustedRendererUrl: string): boolean {
  const target = normalizedDocumentUrl(targetUrl)
  const trusted = normalizedDocumentUrl(trustedRendererUrl)

  return target !== null && trusted !== null && target === trusted
}

export function hardenWebContents(webContents: WebContents, trustedRendererUrl: string): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const denyUnexpectedNavigation = (event: Electron.Event, targetUrl: string): void => {
    if (!isTrustedNavigation(targetUrl, trustedRendererUrl)) {
      event.preventDefault()
    }
  }

  webContents.on('will-navigate', denyUnexpectedNavigation)
  webContents.on('will-redirect', denyUnexpectedNavigation)
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}

export function configureSessionSecurity(
  electronSession: Session,
  trustedRendererUrl: string,
): void {
  electronSession.setPermissionCheckHandler(() => false)
  electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  electronSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      callback({
        requestHeaders: youtubeEmbedRequestHeaders(details.url, details.requestHeaders),
      })
    },
  )

  electronSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }

    if (
      details.resourceType === 'mainFrame' &&
      isTrustedNavigation(details.url, trustedRendererUrl)
    ) {
      responseHeaders['Content-Security-Policy'] = [CONTENT_SECURITY_POLICY]
    }

    callback({ responseHeaders })
  })
}
