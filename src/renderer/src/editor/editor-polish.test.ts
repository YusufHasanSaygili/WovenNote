import { Editor, type Content } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { TiptapDocumentSchema } from '../../../shared/schemas/editor-document'
import {
  SafeBlockLayout,
  SafeColor,
  SafeFontFamily,
  SafeFontSize,
  SafeHighlight,
  SafeTextAlign,
} from './editor-polish-extensions'

const editors: Editor[] = []

function createEditor(content?: Content): Editor {
  const editor = new Editor({
    content,
    extensions: [
      StarterKit,
      TableKit,
      TextStyle,
      SafeColor,
      SafeFontFamily,
      SafeFontSize,
      SafeHighlight,
      SafeTextAlign,
      SafeBlockLayout,
    ],
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
})

describe('editor polish extensions', () => {
  it('inserts, changes, serializes, and reloads a table', () => {
    const editor = createEditor()

    expect(editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })).toBe(true)
    expect(editor.getJSON().content?.[0]?.type).toBe('table')
    expect(editor.commands.addRowAfter()).toBe(true)
    expect(editor.commands.addColumnAfter()).toBe(true)

    const document = TiptapDocumentSchema.parse(editor.getJSON())
    const table = document.content[0]
    expect(table?.type).toBe('table')
    if (table?.type !== 'table') throw new Error('Table was not serialized.')
    expect(table.content).toHaveLength(4)
    expect(table.content[0]?.content).toHaveLength(4)

    const reloaded = createEditor(document)
    expect(reloaded.getJSON()).toEqual(document)
  })

  it('stores allowlisted colors and alignment without inline styles', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'renkli metin' }] }],
    })
    editor.commands.setTextSelection({ from: 1, to: 7 })

    expect(editor.commands.setColor('#b42318')).toBe(true)
    expect(editor.commands.setHighlight({ color: '#fef3c7' })).toBe(true)
    expect(editor.commands.setTextAlign('center')).toBe(true)

    const document = TiptapDocumentSchema.parse(editor.getJSON())
    const paragraph = document.content[0]
    expect(paragraph).toMatchObject({ type: 'paragraph', attrs: { textAlign: 'center' } })
    if (paragraph?.type !== 'paragraph') throw new Error('Paragraph was not serialized.')
    expect(paragraph.content?.[0]).toMatchObject({
      marks: [
        { type: 'textStyle', attrs: { color: '#b42318' } },
        { type: 'highlight', attrs: { color: '#fef3c7' } },
      ],
      text: 'renkli',
    })
    expect(editor.getHTML()).toContain('data-text-color="#b42318"')
    expect(editor.getHTML()).toContain('data-highlight-color="#fef3c7"')
    expect(editor.getHTML()).toContain('data-text-align="center"')
    expect(editor.getHTML()).not.toContain('style=')
  })

  it('stores allowlisted font, point size, line spacing, and indentation without inline styles', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'biçimli metin' }] }],
    })
    editor.commands.setTextSelection({ from: 1, to: 8 })

    expect(editor.commands.setFontFamily('Georgia')).toBe(true)
    expect(editor.commands.setFontSize('18pt')).toBe(true)
    expect(editor.commands.updateAttributes('paragraph', { lineHeight: '1.5', indent: 2 })).toBe(
      true,
    )

    const document = TiptapDocumentSchema.parse(editor.getJSON())
    const paragraph = document.content[0]
    expect(paragraph).toMatchObject({
      type: 'paragraph',
      attrs: { indent: 2, lineHeight: '1.5' },
    })
    if (paragraph?.type !== 'paragraph') throw new Error('Paragraph was not serialized.')
    expect(paragraph.content?.[0]).toMatchObject({
      marks: [
        {
          type: 'textStyle',
          attrs: { color: null, fontFamily: 'Georgia', fontSize: '18pt' },
        },
      ],
      text: 'biçimli',
    })
    expect(editor.getHTML()).toContain('data-font-family="Georgia"')
    expect(editor.getHTML()).toContain('data-font-size="18pt"')
    expect(editor.getHTML()).toContain('data-line-height="1.5"')
    expect(editor.getHTML()).toContain('data-indent="2"')
    expect(editor.getHTML()).not.toContain('style=')
  })

  it('drops unsafe formatting attributes while parsing HTML', () => {
    const editor = createEditor(
      '<p data-line-height="9" data-indent="99"><span data-font-family="url(javascript:1)" data-font-size="999pt">güvenli</span></p>',
    )

    expect(editor.getJSON()).toMatchObject({
      content: [{ attrs: { indent: 0, lineHeight: null }, type: 'paragraph' }],
      type: 'doc',
    })
    expect(editor.getHTML()).not.toContain('javascript')
    expect(editor.getHTML()).not.toContain('999pt')
  })
})
