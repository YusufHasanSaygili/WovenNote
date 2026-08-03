import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import {
  applyInlineAiResult,
  captureInlineAiSelection,
  inlineAiSelectionStillMatches,
} from './inline-ai-selection'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function createEditor(): Editor {
  editor = new Editor({
    extensions: [StarterKit],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Önce hedef sonra' }] }],
    },
  })
  editor.commands.setTextSelection({ from: 6, to: 11 })
  return editor
}

describe('inline AI selection integrity', () => {
  it('replaces exactly the captured range only after acceptance', () => {
    const instance = createEditor()
    const snapshot = captureInlineAiSelection(instance)
    expect(snapshot?.text).toBe('hedef')
    expect(instance.getText()).toBe('Önce hedef sonra')

    expect(applyInlineAiResult(instance, snapshot!, 'rewrite', 'yeni ifade')).toBe(true)
    expect(instance.getText()).toBe('Önce yeni ifade sonra')
  })

  it('refuses a stale range without changing the document', () => {
    const instance = createEditor()
    const snapshot = captureInlineAiSelection(instance)!
    instance.commands.insertContentAt(1, 'Ek ')
    const before = instance.getText()

    expect(inlineAiSelectionStillMatches(instance, snapshot)).toBe(false)
    expect(applyInlineAiResult(instance, snapshot, 'correct', 'değişiklik')).toBe(false)
    expect(instance.getText()).toBe(before)
  })

  it('turns a generated list into safe structured list items', () => {
    const instance = createEditor()
    const snapshot = captureInlineAiSelection(instance)!

    expect(applyInlineAiResult(instance, snapshot, 'list', '- Bir\n- İki')).toBe(true)
    expect(instance.getJSON()).toMatchObject({
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Önce ' }],
        },
        { type: 'bulletList' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' sonra' }],
        },
      ],
    })
    expect(instance.getText()).toContain('Bir')
    expect(instance.getText()).toContain('İki')
  })
})
