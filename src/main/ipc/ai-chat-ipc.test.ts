// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import {
  CancelAiRequestResultSchema,
  ChatThreadResultSchema,
  SendChatMessageResultSchema,
} from '../../shared/schemas/ai-chat-contracts'
import type { AiChatService } from '../services/ai-chat-service'
import { registerAiChatIpcHandlers } from './ai-chat-ipc'

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

describe('AI chat IPC contracts', () => {
  it('validates note-scoped send/get/cancel payloads and results', async () => {
    const getThread = vi.fn(() => ({ noteId: 'note-one', sessionId: null, messages: [] }))
    const sendMessage = vi.fn(async () => ({
      thread: { noteId: 'note-one', sessionId: null, messages: [] },
      contextTruncated: false,
    }))
    const cancelRequest = vi.fn(() => true)
    const ipc = new FakeIpcMain()
    registerAiChatIpcHandlers(
      ipc as unknown as IpcMain,
      { getThread, sendMessage, cancelRequest } as unknown as AiChatService,
    )

    expect(
      ChatThreadResultSchema.parse(
        await ipc.handlers.get(AI_CHANNELS.getThread)!({}, { id: 'note-one' }),
      ),
    ).toEqual({ ok: true, data: { noteId: 'note-one', sessionId: null, messages: [] } })
    expect(
      SendChatMessageResultSchema.parse(
        await ipc.handlers.get(AI_CHANNELS.sendMessage)!(
          {},
          {
            noteId: 'note-one',
            requestId: '11111111-1111-4111-8111-111111111111',
            message: 'Özetle',
          },
        ),
      ),
    ).toMatchObject({ ok: true, data: { contextTruncated: false } })
    expect(
      CancelAiRequestResultSchema.parse(
        await ipc.handlers.get(AI_CHANNELS.cancelRequest)!(
          {},
          {
            requestId: '11111111-1111-4111-8111-111111111111',
          },
        ),
      ),
    ).toEqual({ ok: true, data: { cancelled: true } })
    expect(sendMessage).toHaveBeenCalledWith({
      noteId: 'note-one',
      requestId: '11111111-1111-4111-8111-111111111111',
      message: 'Özetle',
    })
  })

  it('rejects over-posted context so the renderer cannot choose note contents', async () => {
    const sendMessage = vi.fn()
    const ipc = new FakeIpcMain()
    registerAiChatIpcHandlers(
      ipc as unknown as IpcMain,
      {
        getThread: vi.fn(),
        sendMessage,
        cancelRequest: vi.fn(),
      } as unknown as AiChatService,
    )

    const result = SendChatMessageResultSchema.parse(
      await ipc.handlers.get(AI_CHANNELS.sendMessage)!(
        {},
        {
          noteId: 'note-one',
          requestId: '11111111-1111-4111-8111-111111111111',
          message: 'Özetle',
          noteContent: 'Renderer tarafından enjekte edilmemeli',
        },
      ),
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
