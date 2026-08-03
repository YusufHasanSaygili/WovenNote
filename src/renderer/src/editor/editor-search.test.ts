import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { findEditorTextMatches, selectEditorTextMatch } from './editor-search'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('editor search', () => {
  it('finds Turkish case-insensitive results and selects the requested match', () => {
    editor = new Editor({
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'İçerik ilk sonuç' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'İkinci İÇERİK sonucu' }] },
        ],
      },
      extensions: [StarterKit],
    })

    const matches = findEditorTextMatches(editor.state.doc, 'içerik')
    expect(matches).toHaveLength(2)
    selectEditorTextMatch(editor, matches[1])
    expect(
      editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to),
    ).toBe('İÇERİK')
  })

  it('does not join a match across block boundaries', () => {
    editor = new Editor({
      content: '<p>bir</p><p>iki</p>',
      extensions: [StarterKit],
    })

    expect(findEditorTextMatches(editor.state.doc, 'biriki')).toEqual([])
  })
})
