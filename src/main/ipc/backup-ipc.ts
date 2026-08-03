import type { IpcMain } from 'electron'

import { EXPORT_CHANNELS } from '../../shared/ipc-channels'
import {
  CreateBackupResultSchema,
  EmptyBackupInputSchema,
  InspectBackupResultSchema,
  RestoreBackupInputSchema,
  RestoreBackupResultSchema,
  type BackupConflictStrategy,
  type CreateBackupOutcome,
  type InspectBackupOutcome,
  type RestoreBackupOutcome,
} from '../../shared/schemas/backup-contracts'
import { BackupServiceError } from '../services/backup-service'
import { createValidatedHandler } from './validated-handler'

interface BackupOperations {
  createBackup(): Promise<CreateBackupOutcome>
  inspectBackup(): Promise<InspectBackupOutcome>
  restoreBackup(
    importToken: string,
    conflictStrategy: BackupConflictStrategy,
  ): Promise<RestoreBackupOutcome>
}

function backupError(error: unknown): string {
  return error instanceof BackupServiceError
    ? error.publicMessage
    : 'Yedek işlemi tamamlanamadı. Lütfen tekrar deneyin.'
}

export function registerBackupIpcHandlers(
  ipcMain: IpcMain,
  backupService: BackupOperations,
): () => void {
  ipcMain.handle(
    EXPORT_CHANNELS.createBackup,
    createValidatedHandler({
      inputSchema: EmptyBackupInputSchema,
      resultSchema: CreateBackupResultSchema,
      operation: () => backupService.createBackup(),
      operationErrorMessage: backupError,
      validationErrorMessage: 'Yedek oluşturma isteği geçersiz.',
    }),
  )
  ipcMain.handle(
    EXPORT_CHANNELS.inspectBackup,
    createValidatedHandler({
      inputSchema: EmptyBackupInputSchema,
      resultSchema: InspectBackupResultSchema,
      operation: () => backupService.inspectBackup(),
      operationErrorMessage: backupError,
      validationErrorMessage: 'Yedek seçme isteği geçersiz.',
    }),
  )
  ipcMain.handle(
    EXPORT_CHANNELS.restoreBackup,
    createValidatedHandler({
      inputSchema: RestoreBackupInputSchema,
      resultSchema: RestoreBackupResultSchema,
      operation: (input) => backupService.restoreBackup(input.importToken, input.conflictStrategy),
      operationErrorMessage: backupError,
      validationErrorMessage: 'Yedek geri yükleme isteği geçersiz.',
    }),
  )

  return () => {
    ipcMain.removeHandler(EXPORT_CHANNELS.createBackup)
    ipcMain.removeHandler(EXPORT_CHANNELS.inspectBackup)
    ipcMain.removeHandler(EXPORT_CHANNELS.restoreBackup)
  }
}
