import { describe, expect, it } from 'vitest'

import { normalizeEditorLink } from './editor-link'

describe('normalizeEditorLink', () => {
  it('normalizes web and mail links', () => {
    expect(normalizeEditorLink('example.com/docs')).toBe('https://example.com/docs')
    expect(normalizeEditorLink('https://example.com')).toBe('https://example.com/')
    expect(normalizeEditorLink('mailto:test@example.com')).toBe('mailto:test@example.com')
  })

  it('rejects empty and invalid links', () => {
    expect(normalizeEditorLink('')).toBeNull()
    expect(normalizeEditorLink('mailto:not-an-email')).toBeNull()
    expect(normalizeEditorLink('http://[invalid')).toBeNull()
  })
})
