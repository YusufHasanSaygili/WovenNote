// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { ALLOWED_IPC_CHANNELS, EXPORT_CHANNELS } from '../../shared/ipc-channels'
import {
  CreateBackupResultSchema,
  InspectBackupResultSchema,
  RestoreBackupResultSchema,
} from '../../shared/schemas/backup-contracts'
import { BackupServiceError } from '../services/backup-service'
import { registerBackupIpcHandlers } from './backup-ipc'

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

describe('backup IPC', () => {
  it('registers the three explicit channels and validates restore input', async () => {
    const ipc = new FakeIpcMain()
    const restoreBackup = vi.fn(async () => ({
      status: 'restored' as const,
      notesImported: 1,
      notesSkipped: 0,
      attachmentsImported: 0,
    }))
    const unregister = registerBackupIpcHandlers(ipc as unknown as IpcMain, {
      createBackup: async () => ({ status: 'cancelled' }),
      inspectBackup: async () => ({ status: 'cancelled' }),
      restoreBackup,
    })

    expect(new Set(ipc.handlers.keys())).toEqual(
      new Set([
        EXPORT_CHANNELS.createBackup,
        EXPORT_CHANNELS.inspectBackup,
        EXPORT_CHANNELS.restoreBackup,
      ]),
    )
    expect(ALLOWED_IPC_CHANNELS).toEqual(expect.arrayContaining([...ipc.handlers.keys()]))
    expect(
      RestoreBackupResultSchema.parse(
        await ipc.handlers.get(EXPORT_CHANNELS.restoreBackup)!(
          {},
          {
            importToken: 'raw-path-is-not-a-token',
            conflictStrategy: 'replace',
            filePath: 'C:\\secret',
          },
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(restoreBackup).not.toHaveBeenCalled()

    unregister()
    expect(ipc.handlers.size).toBe(0)
  })

  it('round-trips cancellation and maps public backup failures', async () => {
    const ipc = new FakeIpcMain()
    registerBackupIpcHandlers(ipc as unknown as IpcMain, {
      createBackup: async () => ({ status: 'cancelled' }),
      inspectBackup: async () => {
        throw new BackupServiceError('Seçilen yedek geçersiz, bozuk veya desteklenmiyor.')
      },
      restoreBackup: async () => {
        throw new Error('Unexpected')
      },
    })

    expect(
      CreateBackupResultSchema.parse(await ipc.handlers.get(EXPORT_CHANNELS.createBackup)!({}, {})),
    ).toEqual({ ok: true, data: { status: 'cancelled' } })
    expect(
      InspectBackupResultSchema.parse(
        await ipc.handlers.get(EXPORT_CHANNELS.inspectBackup)!({}, {}),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'OPERATION_FAILED',
        message: 'Seçilen yedek geçersiz, bozuk veya desteklenmiyor.',
      },
    })
  })
})
