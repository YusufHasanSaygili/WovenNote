import type {
  NoteLayoutUpdate,
  UpdateNoteLayoutsInput,
  UpdateNoteLayoutsResult,
} from '../../../shared/schemas/note-contracts'

interface LayoutSaveQueueOptions {
  readonly delayMilliseconds?: number
  readonly onError: (message: string) => void
  readonly save: (input: UpdateNoteLayoutsInput) => Promise<UpdateNoteLayoutsResult>
}

export interface LayoutSaveQueue {
  readonly dispose: () => void
  readonly flush: () => Promise<void>
  readonly schedule: (layouts: readonly NoteLayoutUpdate[]) => void
}

export function createLayoutSaveQueue({
  delayMilliseconds = 350,
  onError,
  save,
}: LayoutSaveQueueOptions): LayoutSaveQueue {
  const pending = new Map<string, NoteLayoutUpdate>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let writeChain = Promise.resolve()

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }

    if (pending.size === 0) {
      await writeChain
      return
    }

    const batch = [...pending.values()]
    pending.clear()
    writeChain = writeChain
      .then(async () => {
        const result = await save({ layouts: batch })
        if (!result.ok) {
          throw new Error(result.error.message)
        }
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Kart düzeni kaydedilemedi.')
      })

    await writeChain
  }

  const schedule = (layouts: readonly NoteLayoutUpdate[]): void => {
    for (const layout of layouts) {
      pending.set(layout.id, layout)
    }

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), delayMilliseconds)
  }

  const dispose = (): void => {
    if (timer) clearTimeout(timer)
    timer = undefined
    void flush()
  }

  return { dispose, flush, schedule }
}
