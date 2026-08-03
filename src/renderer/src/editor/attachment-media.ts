import { Node, type Editor } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { AttachmentFileView } from './AttachmentFileView'
import { AttachmentVideoView } from './AttachmentVideoView'

const attachmentReferenceAttributes = () => ({ attachmentId: { default: '' } })

export const AttachmentVideo = Node.create({
  name: 'attachmentVideo',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    ...attachmentReferenceAttributes(),
    alignment: { default: 'center' },
  }),
  parseHTML: () => [{ tag: 'div[data-attachment-video]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { 'data-attachment-video': '', 'data-attachment-id': HTMLAttributes['attachmentId'] },
  ],
  addNodeView: () => ReactNodeViewRenderer(AttachmentVideoView),
})

export const AttachmentFile = Node.create({
  name: 'attachmentFile',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: attachmentReferenceAttributes,
  parseHTML: () => [{ tag: 'div[data-attachment-file]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { 'data-attachment-file': '', 'data-attachment-id': HTMLAttributes['attachmentId'] },
  ],
  addNodeView: () => ReactNodeViewRenderer(AttachmentFileView),
})

export function insertAttachmentMedia(
  editor: Editor,
  type: 'attachmentVideo' | 'attachmentFile',
  attachmentId: string,
): boolean {
  return editor
    .chain()
    .focus()
    .insertContent([
      {
        type,
        attrs:
          type === 'attachmentVideo' ? { attachmentId, alignment: 'center' } : { attachmentId },
      },
      { type: 'paragraph' },
    ])
    .run()
}
