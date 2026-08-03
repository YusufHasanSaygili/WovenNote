// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { ALLOWED_IPC_CHANNELS, ATTACHMENT_CHANNELS } from '../../shared/ipc-channels'
import { PickAttachmentResultSchema } from '../../shared/schemas/attachment-contracts'
import { AttachmentStorageError } from '../services/attachment-service'
import { registerAttachmentIpcHandlers } from './attachment-ipc'

type Handler = (event: unknown, payload: unknown) => Promise<unknown>

class FakeIpcMain {
  readonly handlers = new Map<string, Handler>()

  handle(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
}

describe('attachment IPC contract', () => {
  it('validates the note id and exposes no renderer-provided path field', async () => {
    const ipc = new FakeIpcMain()
    const pickAndStore = vi.fn(async () => ({ status: 'cancelled' as const }))
    registerAttachmentIpcHandlers(ipc as unknown as IpcMain, {
      get: () => {
        throw new Error('Unexpected get.')
      },
      openExternal: async () => {
        throw new Error('Unexpected open.')
      },
      pickAndStore,
    })
    const handler = ipc.handlers.get(ATTACHMENT_CHANNELS.pickAndStore)!

    const valid = PickAttachmentResultSchema.parse(await handler({}, { noteId: 'note-001' }))
    const overPosted = PickAttachmentResultSchema.parse(
      await handler({}, { noteId: 'note-001', filePath: 'C:\\secret.txt' }),
    )

    expect(valid).toEqual({ ok: true, data: { status: 'cancelled' } })
    expect(overPosted).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(pickAndStore).toHaveBeenCalledTimes(1)
    expect(ALLOWED_IPC_CHANNELS).toContain(ATTACHMENT_CHANNELS.pickAndStore)
  })

  it('returns a safe, useful storage error and unregisters cleanly', async () => {
    const ipc = new FakeIpcMain()
    const unregister = registerAttachmentIpcHandlers(ipc as unknown as IpcMain, {
      get: () => {
        throw new Error('Unexpected get.')
      },
      openExternal: async () => {
        throw new Error('Unexpected open.')
      },
      pickAndStore: async () => {
        throw new AttachmentStorageError('Dosya 100 MB boyut sınırını aşıyor.')
      },
    })
    const handler = ipc.handlers.get(ATTACHMENT_CHANNELS.pickAndStore)!

    await expect(handler({}, { noteId: 'note-001' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'OPERATION_FAILED',
        message: 'Dosya 100 MB boyut sınırını aşıyor.',
      },
    })

    unregister()
    expect(ipc.handlers.size).toBe(0)
  })

  it('allows opening only by attachment id and rejects URL or path over-posting', async () => {
    const ipc = new FakeIpcMain()
    const openExternal = vi.fn(async () => ({ opened: true as const }))
    registerAttachmentIpcHandlers(ipc as unknown as IpcMain, {
      get: () => {
        throw new Error('Unexpected get.')
      },
      openExternal,
      pickAndStore: async () => ({ status: 'cancelled' }),
    })
    const handler = ipc.handlers.get(ATTACHMENT_CHANNELS.openExternal)!

    await expect(handler({}, { attachmentId: 'attachment-001' })).resolves.toEqual({
      ok: true,
      data: { opened: true },
    })
    await expect(
      handler(
        {},
        {
          attachmentId: 'attachment-001',
          url: 'https://example.com',
          filePath: 'C:\\private.txt',
        },
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(new Set(ipc.handlers.keys())).toEqual(new Set(Object.values(ATTACHMENT_CHANNELS)))
  })
})
