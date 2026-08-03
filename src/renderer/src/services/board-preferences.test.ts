import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_BOARD_PREFERENCES,
  loadBoardPreferences,
  saveBoardPreferences,
} from './board-preferences'

const STORAGE_KEY = 'wovennote.board-preferences.v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('board preferences', () => {
  it('uses safe defaults when the stored value is missing or invalid', () => {
    expect(loadBoardPreferences()).toEqual(DEFAULT_BOARD_PREFERENCES)

    window.localStorage.setItem(STORAGE_KEY, '{"version":1,"view":"unknown"}')
    expect(loadBoardPreferences()).toEqual(DEFAULT_BOARD_PREFERENCES)
  })

  it('persists and restores a validated preference envelope', () => {
    const preferences = { version: 1 as const, view: 'list' as const, sidebarCollapsed: true }

    expect(saveBoardPreferences(preferences)).toBe(true)
    expect(loadBoardPreferences()).toEqual(preferences)
  })

  it('loads board preferences saved before the WovenNote rename', () => {
    const legacyKey = ['note', 'gpt.board-preferences.v1'].join('')
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({ version: 1, view: 'list', sidebarCollapsed: true }),
    )

    expect(loadBoardPreferences()).toEqual({
      version: 1,
      view: 'list',
      sidebarCollapsed: true,
    })
  })

  it('does not write an invalid preference value', () => {
    const invalidPreferences = {
      version: 1 as const,
      view: 'list' as const,
      sidebarCollapsed: 'yes',
    }

    expect(saveBoardPreferences(invalidPreferences as never)).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
