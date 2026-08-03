import { z } from 'zod'

const STORAGE_KEY = 'wovennote.board-preferences.v1'
const LEGACY_STORAGE_KEY = ['note', 'gpt.board-preferences.v1'].join('')

const BoardPreferencesSchema = z
  .object({
    version: z.literal(1),
    view: z.enum(['grid', 'list']),
    sidebarCollapsed: z.boolean(),
  })
  .strict()

export type BoardPreferences = z.infer<typeof BoardPreferencesSchema>

export const DEFAULT_BOARD_PREFERENCES: BoardPreferences = Object.freeze({
  version: 1,
  view: 'grid',
  sidebarCollapsed: false,
})

export function loadBoardPreferences(storage: Storage = window.localStorage): BoardPreferences {
  try {
    const serialized = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY)
    if (!serialized) return DEFAULT_BOARD_PREFERENCES

    const parsed = BoardPreferencesSchema.safeParse(JSON.parse(serialized))
    return parsed.success ? parsed.data : DEFAULT_BOARD_PREFERENCES
  } catch {
    return DEFAULT_BOARD_PREFERENCES
  }
}

export function saveBoardPreferences(
  preferences: BoardPreferences,
  storage: Storage = window.localStorage,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(BoardPreferencesSchema.parse(preferences)))
    return true
  } catch {
    return false
  }
}
