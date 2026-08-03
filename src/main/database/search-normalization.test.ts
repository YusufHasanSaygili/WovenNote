// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { normalizeTurkishSearchText } from './search-normalization'

describe('normalizeTurkishSearchText', () => {
  it('folds dotted and dotless Turkish letters with tr-TR casing', () => {
    expect(normalizeTurkishSearchText('  İSTANBUL   İÇERİĞİ  ')).toBe('istanbul içeriği')
    expect(normalizeTurkishSearchText('IŞIK')).toBe('ışık')
  })
})
