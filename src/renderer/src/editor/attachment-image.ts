import { mergeAttributes, Node, type Editor } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { AttachmentImageView } from './AttachmentImageView'

export const AttachmentImageNode = Node.create({
  name: 'attachmentImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      attachmentId: { default: '' },
      alt: { default: '' },
      alignment: { default: 'center' },
      width: { default: 50 },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-attachment-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-attachment-image': '',
        'data-attachment-id': HTMLAttributes['attachmentId'],
      }),
    ]
  },
})

export const AttachmentImage = AttachmentImageNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentImageView)
  },
})

export function insertAttachmentImage(editor: Editor, attachmentId: string): boolean {
  return editor
    .chain()
    .focus()
    .insertContent([
      {
        type: 'attachmentImage',
        attrs: { attachmentId, alt: '', alignment: 'center', width: 50 },
      },
      { type: 'paragraph' },
    ])
    .run()
}
