import type { IpcMain } from 'electron'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import {
  CancelInlineAiActionInputSchema,
  CancelInlineAiActionResultSchema,
  RunInlineAiActionInputSchema,
  RunInlineAiActionResultSchema,
} from '../../shared/schemas/inline-ai-contracts'
import { InlineAiError, type InlineAiService } from '../services/inline-ai-service'
import { createValidatedHandler } from './validated-handler'

function inlineAiError(error: unknown): string {
  return error instanceof InlineAiError
    ? error.message
    : 'AI hızlı işlemi tamamlanamadı. Lütfen tekrar deneyin.'
}

export function registerInlineAiIpcHandlers(
  ipcMain: IpcMain,
  service: InlineAiService,
): () => void {
  ipcMain.handle(
    AI_CHANNELS.runInlineAction,
    createValidatedHandler({
      inputSchema: RunInlineAiActionInputSchema,
      resultSchema: RunInlineAiActionResultSchema,
      operation: (input) => service.run(input),
      operationErrorMessage: inlineAiError,
      validationErrorMessage: 'Seçili metin AI işlemi geçersiz.',
    }),
  )
  ipcMain.handle(
    AI_CHANNELS.cancelInlineAction,
    createValidatedHandler({
      inputSchema: CancelInlineAiActionInputSchema,
      resultSchema: CancelInlineAiActionResultSchema,
      operation: (input) => ({ cancelled: service.cancel(input.requestId) }),
      operationErrorMessage: inlineAiError,
    }),
  )

  return () => {
    ipcMain.removeHandler(AI_CHANNELS.cancelInlineAction)
    ipcMain.removeHandler(AI_CHANNELS.runInlineAction)
  }
}
