import type { IpcMain } from 'electron'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import {
  CancelAiRequestInputSchema,
  CancelAiRequestResultSchema,
  ChatThreadResultSchema,
  GetChatThreadInputSchema,
  SendChatMessageInputSchema,
  SendChatMessageResultSchema,
} from '../../shared/schemas/ai-chat-contracts'
import { AiChatError, type AiChatService } from '../services/ai-chat-service'
import { createValidatedHandler } from './validated-handler'

function chatOperationError(error: unknown): string {
  return error instanceof AiChatError
    ? error.message
    : 'AI sohbet işlemi tamamlanamadı. Lütfen tekrar deneyin.'
}

export function registerAiChatIpcHandlers(ipcMain: IpcMain, service: AiChatService): () => void {
  ipcMain.handle(
    AI_CHANNELS.getThread,
    createValidatedHandler({
      inputSchema: GetChatThreadInputSchema,
      resultSchema: ChatThreadResultSchema,
      operation: (input) => service.getThread(input.id),
      operationErrorMessage: chatOperationError,
    }),
  )
  ipcMain.handle(
    AI_CHANNELS.sendMessage,
    createValidatedHandler({
      inputSchema: SendChatMessageInputSchema,
      resultSchema: SendChatMessageResultSchema,
      operation: (input) => service.sendMessage(input),
      operationErrorMessage: chatOperationError,
      validationErrorMessage: 'Gönderilen AI sohbet isteği geçersiz.',
    }),
  )
  ipcMain.handle(
    AI_CHANNELS.cancelRequest,
    createValidatedHandler({
      inputSchema: CancelAiRequestInputSchema,
      resultSchema: CancelAiRequestResultSchema,
      operation: (input) => ({ cancelled: service.cancelRequest(input.requestId) }),
      operationErrorMessage: chatOperationError,
    }),
  )

  return () => {
    ipcMain.removeHandler(AI_CHANNELS.cancelRequest)
    ipcMain.removeHandler(AI_CHANNELS.getThread)
    ipcMain.removeHandler(AI_CHANNELS.sendMessage)
  }
}
