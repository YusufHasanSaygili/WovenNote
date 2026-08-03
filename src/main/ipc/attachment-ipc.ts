import type { IpcMain } from 'electron'

import { ATTACHMENT_CHANNELS } from '../../shared/ipc-channels'
import {
  AttachmentIdInputSchema,
  GetAttachmentResultSchema,
  OpenAttachmentResultSchema,
  PickAttachmentInputSchema,
  PickAttachmentResultSchema,
} from '../../shared/schemas/attachment-contracts'
import { AttachmentStorageError, type AttachmentService } from '../services/attachment-service'
import { createValidatedHandler } from './validated-handler'

export function registerAttachmentIpcHandlers(
  ipcMain: IpcMain,
  attachmentService: Pick<AttachmentService, 'get' | 'openExternal' | 'pickAndStore'>,
): () => void {
  const operationErrorMessage = (error: unknown): string =>
    error instanceof AttachmentStorageError
      ? error.publicMessage
      : 'Dosya işlemi tamamlanamadı. Lütfen tekrar deneyin.'
  const validationErrorMessage = 'Gönderilen dosya eki bilgileri geçersiz.'

  ipcMain.handle(
    ATTACHMENT_CHANNELS.get,
    createValidatedHandler({
      inputSchema: AttachmentIdInputSchema,
      operation: (input) => attachmentService.get(input),
      operationErrorMessage,
      resultSchema: GetAttachmentResultSchema,
      validationErrorMessage,
    }),
  )

  ipcMain.handle(
    ATTACHMENT_CHANNELS.openExternal,
    createValidatedHandler({
      inputSchema: AttachmentIdInputSchema,
      operation: (input) => attachmentService.openExternal(input),
      operationErrorMessage,
      resultSchema: OpenAttachmentResultSchema,
      validationErrorMessage,
    }),
  )

  ipcMain.handle(
    ATTACHMENT_CHANNELS.pickAndStore,
    createValidatedHandler({
      inputSchema: PickAttachmentInputSchema,
      operation: (input) => attachmentService.pickAndStore(input),
      operationErrorMessage,
      resultSchema: PickAttachmentResultSchema,
      validationErrorMessage,
    }),
  )

  return () => {
    ipcMain.removeHandler(ATTACHMENT_CHANNELS.get)
    ipcMain.removeHandler(ATTACHMENT_CHANNELS.openExternal)
    ipcMain.removeHandler(ATTACHMENT_CHANNELS.pickAndStore)
  }
}
