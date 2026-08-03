// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  EditorDocumentEnvelopeSchema,
  editorDocumentPlainText,
  TiptapDocumentSchema,
  type TiptapDocument,
} from './editor-document'

describe('long editor document performance', () => {
  it('validates and extracts a multi-thousand-block note within the desktop target', () => {
    const content: TiptapDocument = {
      type: 'doc',
      content: Array.from({ length: 5_000 }, (_, index) => ({
        type: 'paragraph' as const,
        content: [{ type: 'text' as const, text: `Uzun not satırı ${index} ${'x'.repeat(180)}` }],
      })),
    }
    const startedAt = performance.now()
    const parsed = EditorDocumentEnvelopeSchema.parse({
      documentVersion: 1,
      editor: 'tiptap',
      content,
    })
    const plainText = editorDocumentPlainText(TiptapDocumentSchema.parse(parsed.content))
    const elapsedMs = performance.now() - startedAt

    expect(plainText).toContain('Uzun not satırı 4999')
    expect(plainText.length).toBeGreaterThan(900_000)
    expect(elapsedMs).toBeLessThan(2_000)
  })
})
