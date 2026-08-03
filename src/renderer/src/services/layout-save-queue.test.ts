import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UpdateNoteLayoutsInput } from '../../../shared/schemas/note-contracts'
import { createLayoutSaveQueue } from './layout-save-queue'

afterEach(() => {
  vi.useRealTimers()
})

describe('layout save queue', () => {
  it('coalesces rapid changes and writes only the newest position for each note', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async (input: UpdateNoteLayoutsInput) => ({
      ok: true as const,
      data: { updatedIds: input.layouts.map((layout) => layout.id) },
    }))
    const onError = vi.fn()
    const queue = createLayoutSaveQueue({ delayMilliseconds: 100, onError, save })

    queue.schedule([{ id: 'note-1', gridX: 0, gridY: 0, gridWidth: 3, gridHeight: 4 }])
    queue.schedule([{ id: 'note-1', gridX: 3, gridY: 1, gridWidth: 4, gridHeight: 3 }])
    queue.schedule([{ id: 'note-1', gridX: 6, gridY: 2, gridWidth: 6, gridHeight: 2 }])
    await vi.advanceTimersByTimeAsync(100)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({
      layouts: [{ id: 'note-1', gridX: 6, gridY: 2, gridWidth: 6, gridHeight: 2 }],
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a failed write without leaving an unhandled rejection', async () => {
    const onError = vi.fn()
    const queue = createLayoutSaveQueue({
      onError,
      save: async () => ({
        ok: false,
        error: { code: 'OPERATION_FAILED', message: 'Düzen yazılamadı.' },
      }),
    })

    queue.schedule([{ id: 'note-1', gridX: 0, gridY: 0, gridWidth: 3, gridHeight: 4 }])
    await queue.flush()

    expect(onError).toHaveBeenCalledWith('Düzen yazılamadı.')
  })
})
