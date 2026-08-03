// @vitest-environment node

import type { Protocol } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import {
  ATTACHMENT_PROTOCOL,
  attachmentIdFromUrl,
  registerAttachmentProtocol,
} from './attachment-protocol'

type ProtocolHandler = (request: { url: string }) => Promise<Response>

class FakeProtocol {
  handler: ProtocolHandler | undefined
  unhandled: string | undefined

  handle(scheme: string, handler: ProtocolHandler): void {
    expect(scheme).toBe(ATTACHMENT_PROTOCOL)
    this.handler = handler
  }

  unhandle(scheme: string): void {
    this.unhandled = scheme
  }
}

describe('attachment protocol', () => {
  it('accepts only a media-host URL with a simple attachment id', () => {
    expect(attachmentIdFromUrl('wovennote-attachment://media/attachment-001')).toBe(
      'attachment-001',
    )
    expect(attachmentIdFromUrl('wovennote-attachment://media/../../secret')).toBeNull()
    expect(attachmentIdFromUrl('https://media/attachment-001')).toBeNull()
    expect(attachmentIdFromUrl('wovennote-attachment://other/attachment-001')).toBeNull()
  })

  it('resolves the id in main, returns missing safely and unregisters', async () => {
    const protocol = new FakeProtocol()
    const resolveStoredFile = vi.fn((id: string) =>
      id === 'attachment-001'
        ? { filePath: 'A:\\controlled\\attachment-001.png', mimeType: 'image/png' }
        : null,
    )
    const fetchFile = vi.fn(async () => new Response('image-bytes', { status: 200 }))
    const unregister = registerAttachmentProtocol(
      protocol as unknown as Protocol,
      { resolveStoredFile },
      fetchFile,
    )

    await expect(
      protocol.handler!({ url: 'wovennote-attachment://media/attachment-001' }),
    ).resolves.toMatchObject({ status: 200 })
    await expect(
      protocol.handler!({ url: 'wovennote-attachment://media/missing' }),
    ).resolves.toMatchObject({ status: 404 })
    expect(fetchFile).toHaveBeenCalledWith('A:\\controlled\\attachment-001.png')
    expect(fetchFile).toHaveBeenCalledTimes(1)

    unregister()
    expect(protocol.unhandled).toBe(ATTACHMENT_PROTOCOL)
  })
})
