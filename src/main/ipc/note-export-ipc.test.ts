// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { ALLOWED_IPC_CHANNELS, EXPORT_CHANNELS } from '../../shared/ipc-channels'
import { ExportNoteResultSchema } from '../../shared/schemas/export-contracts'
import { registerNoteExportIpcHandlers } from './note-export-ipc'

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

describe('note export IPC', () => {
  it('validates inputs and exposes only the allowlisted export channel', async () => {
    const ipc = new FakeIpcMain()
    const exportNote = vi.fn(async () => ({ status: 'cancelled' as const }))
    const unregister = registerNoteExportIpcHandlers(ipc as unknown as IpcMain, { exportNote })
    const handler = ipc.handlers.get(EXPORT_CHANNELS.exportNote)!

    expect(ALLOWED_IPC_CHANNELS).toContain(EXPORT_CHANNELS.exportNote)
    expect(
      ExportNoteResultSchema.parse(
        await handler({}, { noteId: 'note-001', format: 'json', path: 'C:\\secret' }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(exportNote).not.toHaveBeenCalled()

    expect(
      ExportNoteResultSchema.parse(await handler({}, { noteId: 'note-001', format: 'json' })),
    ).toEqual({ ok: true, data: { status: 'cancelled' } })
    unregister()
    expect(ipc.handlers.size).toBe(0)
  })

  it('returns a friendly failure when the selected destination is invalid', async () => {
    const ipc = new FakeIpcMain()
    registerNoteExportIpcHandlers(ipc as unknown as IpcMain, {
      exportNote: async () => {
        throw new Error('ENOENT')
      },
    })

    expect(
      ExportNoteResultSchema.parse(
        await ipc.handlers.get(EXPORT_CHANNELS.exportNote)!(
          {},
          {
            noteId: 'note-001',
            format: 'txt',
          },
        ),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'OPERATION_FAILED',
        message: 'Not dışa aktarılamadı. Hedef klasörü ve izinleri kontrol edin.',
      },
    })
  })
})
