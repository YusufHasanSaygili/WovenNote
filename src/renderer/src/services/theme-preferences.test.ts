import { describe, expect, it, vi } from 'vitest'

import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from './theme-preferences'

describe('theme preferences', () => {
  it('loads only supported values and defaults to system', () => {
    expect(loadThemePreference({ getItem: () => 'dark' })).toBe('dark')
    expect(loadThemePreference({ getItem: () => 'contrast' })).toBe('system')
    expect(
      loadThemePreference({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe('system')
  })

  it('keeps the theme selected before the WovenNote rename', () => {
    const legacyKey = ['note', 'gpt.theme.v1'].join('')
    expect(loadThemePreference({ getItem: (key) => (key === legacyKey ? 'dark' : null) })).toBe(
      'dark',
    )
  })

  it('resolves system changes without replacing the preference', () => {
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('persists the selected mode under the stable key', () => {
    const setItem = vi.fn()
    expect(saveThemePreference({ setItem }, 'dark')).toBe(true)
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
  })
})
