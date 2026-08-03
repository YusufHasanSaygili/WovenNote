// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import {
  AiResponseNoteResultSchema,
  CopyAiResponseResultSchema,
} from '../../shared/schemas/ai-chat-contracts'
import type { AiResponseActionService } from '../services/ai-response-action-service'
import { registerAiResponseActionIpcHandlers } from './ai-response-action-ipc'

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

describe('AI response action IPC contracts', () => {
  it('rejects over-posted content before any note mutation', async () => {
    const appendResponseToNote = vi.fn()
    const ipc = new FakeIpcMain()
    registerAiResponseActionIpcHandlers(
      ipc as unknown as IpcMain,
      {
        appendResponseToNote,
        copyResponse: vi.fn(),
        createNoteFromResponse: vi.fn(),
      } as unknown as AiResponseActionService,
    )

    const result = AiResponseNoteResultSchema.parse(
      await ipc.handlers.get(AI_CHANNELS.appendResponseToNote)!(
        {},
        {
          noteId: 'note-one',
          messageId: '22222222-2222-4222-8222-222222222222',
          responseText: 'Renderer tarafından seçilmemeli',
        },
      ),
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(appendResponseToNote).not.toHaveBeenCalled()
  })

  it('returns accessible copy success through the allowlisted channel', async () => {
    const copyResponse = vi.fn(() => ({ copied: true as const }))
    const ipc = new FakeIpcMain()
    registerAiResponseActionIpcHandlers(
      ipc as unknown as IpcMain,
      {
        appendResponseToNote: vi.fn(),
        copyResponse,
        createNoteFromResponse: vi.fn(),
      } as unknown as AiResponseActionService,
    )

    const input = {
      noteId: 'note-one',
      messageId: '22222222-2222-4222-8222-222222222222',
    }
    expect(
      CopyAiResponseResultSchema.parse(
        await ipc.handlers.get(AI_CHANNELS.copyResponse)!({}, input),
      ),
    ).toEqual({ ok: true, data: { copied: true } })
    expect(copyResponse).toHaveBeenCalledWith(input)
  })
})
