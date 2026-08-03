import { describe, expect, it, vi } from 'vitest'

import {
  LANGUAGE_STORAGE_KEY,
  loadLanguagePreference,
  saveLanguagePreference,
  translate,
} from './i18n'

describe('language preferences', () => {
  it('defaults to Turkish and accepts only supported stored languages', () => {
    expect(loadLanguagePreference({ getItem: () => null })).toBe('tr')
    expect(loadLanguagePreference({ getItem: () => 'en' })).toBe('en')
    expect(loadLanguagePreference({ getItem: () => 'de' })).toBe('tr')
  })

  it('keeps the language selected before the WovenNote rename', () => {
    const legacyKey = ['note', 'gpt.language.v1'].join('')
    expect(loadLanguagePreference({ getItem: (key) => (key === legacyKey ? 'en' : null) })).toBe(
      'en',
    )
  })

  it('persists a stable preference and translates parameterized text', () => {
    const setItem = vi.fn()
    expect(saveLanguagePreference({ setItem }, 'en')).toBe(true)
    expect(setItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'en')
    expect(translate('en', 'Son kayıt {{time}}', { time: '10:30' })).toBe('Last saved 10:30')
    expect(translate('tr', 'Son kayıt {{time}}', { time: '10:30' })).toBe('Son kayıt 10:30')
    expect(translate('en', 'GPT-5.6 Sol — En yüksek kalite')).toBe('GPT-5.6 Sol — Highest quality')
    expect(translate('en', 'GPT-5.6 Terra — Dengeli')).toBe('GPT-5.6 Terra — Balanced')
    expect(translate('en', 'GPT-5.6 Luna — Ekonomik')).toBe('GPT-5.6 Luna — Economical')
  })
})
