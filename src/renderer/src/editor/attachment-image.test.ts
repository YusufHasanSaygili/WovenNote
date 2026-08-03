import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { AttachmentImageNode, insertAttachmentImage } from './attachment-image'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('attachment image editor command', () => {
  it('inserts an attachmentId-only block between two paragraphs', () => {
    editor = new Editor({
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Önce' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Sonra' }] },
        ],
      },
      extensions: [StarterKit, AttachmentImageNode],
    })
    editor.commands.setTextSelection(5)

    expect(insertAttachmentImage(editor, 'attachment-001')).toBe(true)
    expect(editor.getJSON()).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Önce' }] },
        {
          type: 'attachmentImage',
          attrs: {
            attachmentId: 'attachment-001',
            alt: '',
            alignment: 'center',
            width: 50,
          },
        },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Sonra' }] },
      ],
    })
  })
})
