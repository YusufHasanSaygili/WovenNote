// @vitest-environment node

import type { IpcMain } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import { AI_CHANNELS } from '../../shared/ipc-channels'
import { RunInlineAiActionResultSchema } from '../../shared/schemas/inline-ai-contracts'
import type { InlineAiService } from '../services/inline-ai-service'
import { registerInlineAiIpcHandlers } from './inline-ai-ipc'

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

describe('inline AI IPC', () => {
  it('accepts only the strict allowlisted selection contract', async () => {
    const run = vi.fn(async (input) => ({ requestId: input.requestId, text: 'Sonuç' }))
    const ipc = new FakeIpcMain()
    registerInlineAiIpcHandlers(
      ipc as unknown as IpcMain,
      { run, cancel: vi.fn() } as unknown as InlineAiService,
    )
    const input = {
      noteId: 'note-one',
      requestId: '11111111-1111-4111-8111-111111111111',
      action: 'summarize',
      selectedText: 'Seçim',
    }
    expect(
      RunInlineAiActionResultSchema.parse(
        await ipc.handlers.get(AI_CHANNELS.runInlineAction)!({}, input),
      ),
    ).toEqual({ ok: true, data: { requestId: input.requestId, text: 'Sonuç' } })

    const overposted = await ipc.handlers.get(AI_CHANNELS.runInlineAction)!(
      {},
      {
        ...input,
        wholeDocument: 'Renderer bunu seçmemeli',
      },
    )
    expect(RunInlineAiActionResultSchema.parse(overposted)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    })
    expect(run).toHaveBeenCalledTimes(1)
  })
})
