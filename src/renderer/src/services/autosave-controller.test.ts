import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAutosaveController, type AutosaveSnapshot } from './autosave-controller'

afterEach(() => {
  vi.useRealTimers()
})

describe('autosave controller', () => {
  it('debounces rapid changes and saves only the latest payload', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const states: AutosaveSnapshot[] = []
    const controller = createAutosaveController({
      delayMilliseconds: 100,
      now: () => new Date('2026-07-28T17:30:00.000Z'),
      onStateChange: (state) => states.push(state),
      save,
    })

    controller.schedule('a')
    controller.schedule('ab')
    controller.schedule('abc')
    await vi.advanceTimersByTimeAsync(99)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
    expect(states.map((state) => state.status)).toEqual([
      'dirty',
      'dirty',
      'dirty',
      'saving',
      'saved',
    ])
    expect(states.at(-1)?.lastSavedAt?.toISOString()).toBe('2026-07-28T17:30:00.000Z')
  })

  it('flushes immediately and serializes a newer change behind an in-flight save', async () => {
    let resolveFirst: (() => void) | undefined
    const saved: string[] = []
    const save = vi.fn(
      (payload: string) =>
        new Promise<void>((resolve) => {
          saved.push(payload)
          if (payload === 'first') resolveFirst = resolve
          else resolve()
        }),
    )
    const controller = createAutosaveController({
      onStateChange: () => undefined,
      save,
    })

    controller.schedule('first')
    const firstFlush = controller.flush()
    controller.schedule('latest')
    resolveFirst?.()
    await firstFlush
    await controller.flush()

    expect(saved).toEqual(['first', 'latest'])
    expect(controller.hasPendingChanges()).toBe(false)
  })

  it('keeps a failed payload pending so a manual flush can retry it', async () => {
    const states: AutosaveSnapshot[] = []
    const save = vi
      .fn<(_payload: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Disk dolu.'))
      .mockResolvedValueOnce(undefined)
    const controller = createAutosaveController({
      onStateChange: (state) => states.push(state),
      save,
    })

    controller.schedule('korunan')
    await controller.flush()
    expect(controller.hasPendingChanges()).toBe(true)
    expect(states.at(-1)).toMatchObject({ status: 'error', error: 'Disk dolu.' })

    await controller.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(controller.hasPendingChanges()).toBe(false)
  })
})
