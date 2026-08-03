import type { IpcMain } from 'electron'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import {
  AiResponseActionInputSchema,
  AiResponseNoteResultSchema,
  CopyAiResponseResultSchema,
} from '../../shared/schemas/ai-chat-contracts'
import {
  AiResponseActionError,
  type AiResponseActionService,
} from '../services/ai-response-action-service'
import { createValidatedHandler } from './validated-handler'

function actionError(error: unknown): string {
  return error instanceof AiResponseActionError
    ? error.message
    : 'AI yanıtı eylemi tamamlanamadı. Lütfen tekrar deneyin.'
}

export function registerAiResponseActionIpcHandlers(
  ipcMain: IpcMain,
  service: AiResponseActionService,
): () => void {
  ipcMain.handle(
    AI_CHANNELS.copyResponse,
    createValidatedHandler({
      inputSchema: AiResponseActionInputSchema,
      resultSchema: CopyAiResponseResultSchema,
      operation: (input) => service.copyResponse(input),
      operationErrorMessage: actionError,
    }),
  )
  ipcMain.handle(
    AI_CHANNELS.appendResponseToNote,
    createValidatedHandler({
      inputSchema: AiResponseActionInputSchema,
      resultSchema: AiResponseNoteResultSchema,
      operation: (input) => service.appendResponseToNote(input),
      operationErrorMessage: actionError,
    }),
  )
  ipcMain.handle(
    AI_CHANNELS.createNoteFromResponse,
    createValidatedHandler({
      inputSchema: AiResponseActionInputSchema,
      resultSchema: AiResponseNoteResultSchema,
      operation: (input) => service.createNoteFromResponse(input),
      operationErrorMessage: actionError,
    }),
  )

  return () => {
    ipcMain.removeHandler(AI_CHANNELS.appendResponseToNote)
    ipcMain.removeHandler(AI_CHANNELS.copyResponse)
    ipcMain.removeHandler(AI_CHANNELS.createNoteFromResponse)
  }
}
