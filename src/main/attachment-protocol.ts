import { pathToFileURL } from 'node:url'

import { net, type Protocol } from 'electron'

import type { AttachmentService } from './services/attachment-service'

export const ATTACHMENT_PROTOCOL = 'wovennote-attachment'

export function attachmentIdFromUrl(value: string): string | null {
  const prefix = `${ATTACHMENT_PROTOCOL}://media/`
  if (!value.startsWith(prefix)) return null
  const rawAttachmentId = value.slice(prefix.length)
  if (!rawAttachmentId || /[/?#]/.test(rawAttachmentId)) return null

  try {
    const url = new URL(value)
    if (url.protocol !== `${ATTACHMENT_PROTOCOL}:` || url.hostname !== 'media') return null
    const attachmentId = decodeURIComponent(rawAttachmentId)
    return /^[a-zA-Z0-9-]{1,100}$/.test(attachmentId) ? attachmentId : null
  } catch {
    return null
  }
}

export function registerAttachmentProtocol(
  electronProtocol: Protocol,
  resolver: Pick<AttachmentService, 'resolveStoredFile'>,
  fetchFile: (filePath: string) => Promise<Response> = (filePath) =>
    net.fetch(pathToFileURL(filePath).href),
): () => void {
  electronProtocol.handle(ATTACHMENT_PROTOCOL, async (request) => {
    const attachmentId = attachmentIdFromUrl(request.url)
    const content = attachmentId ? resolver.resolveStoredFile(attachmentId) : null
    if (!content) return new Response(null, { status: 404 })

    try {
      return await fetchFile(content.filePath)
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  return () => electronProtocol.unhandle(ATTACHMENT_PROTOCOL)
}
