export const AUTOSAVE_DEBOUNCE_MILLISECONDS = 800

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface AutosaveSnapshot {
  readonly error: string | null
  readonly lastSavedAt: Date | null
  readonly status: AutosaveStatus
}

interface AutosaveControllerOptions<TPayload> {
  readonly delayMilliseconds?: number
  readonly now?: () => Date
  readonly onStateChange: (snapshot: AutosaveSnapshot) => void
  readonly save: (payload: TPayload) => Promise<void>
}

export interface AutosaveController<TPayload> {
  readonly dispose: () => void
  readonly flush: () => Promise<void>
  readonly hasPendingChanges: () => boolean
  readonly schedule: (payload: TPayload) => void
  readonly setSaveHandler: (save: (payload: TPayload) => Promise<void>) => void
}

export function createAutosaveController<TPayload>({
  delayMilliseconds = AUTOSAVE_DEBOUNCE_MILLISECONDS,
  now = () => new Date(),
  onStateChange,
  save,
}: AutosaveControllerOptions<TPayload>): AutosaveController<TPayload> {
  let latestPayload: TPayload | undefined
  let latestRevision = 0
  let savedRevision = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined
  let lastSavedAt: Date | null = null
  let saveHandler = save

  const emit = (status: AutosaveStatus, error: string | null = null): void =>
    onStateChange({ error, lastSavedAt, status })

  const scheduleTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), delayMilliseconds)
  }

  const flush = async (): Promise<void> => {
    if (timer) clearTimeout(timer)
    timer = undefined

    if (inFlight) {
      await inFlight
      if (latestRevision > savedRevision) await flush()
      return
    }

    if (latestPayload === undefined || latestRevision <= savedRevision) return

    const payload = latestPayload
    const revision = latestRevision
    emit('saving')
    inFlight = saveHandler(payload)
      .then(() => {
        savedRevision = revision
        if (latestRevision > savedRevision) {
          emit('dirty')
          scheduleTimer()
        } else {
          lastSavedAt = now()
          emit('saved')
        }
      })
      .catch((error: unknown) => {
        emit('error', error instanceof Error ? error.message : 'Not kaydedilemedi.')
      })
      .finally(() => {
        inFlight = undefined
      })

    await inFlight
  }

  const schedule = (payload: TPayload): void => {
    latestPayload = payload
    latestRevision += 1
    emit('dirty')
    scheduleTimer()
  }

  const hasPendingChanges = (): boolean => latestRevision > savedRevision

  const setSaveHandler = (nextSaveHandler: (payload: TPayload) => Promise<void>): void => {
    saveHandler = nextSaveHandler
  }

  const dispose = (): void => {
    if (timer) clearTimeout(timer)
    timer = undefined
    void flush()
  }

  return { dispose, flush, hasPendingChanges, schedule, setSaveHandler }
}
