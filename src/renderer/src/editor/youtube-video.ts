import { mergeAttributes, Node, type Editor } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { YouTubeVideoView } from './YouTubeVideoView'
import { isYouTubeVideoId } from './youtube-url'

export const YouTubeVideoNode = Node.create({
  name: 'youtubeVideo',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { videoId: { default: '' }, alignment: { default: 'center' } }
  },

  parseHTML() {
    return [{ tag: 'div[data-youtube-video]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-youtube-video': '',
        'data-youtube-video-id': HTMLAttributes['videoId'],
      }),
    ]
  },
})

export const YouTubeVideo = YouTubeVideoNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(YouTubeVideoView)
  },
})

export function insertYouTubeVideo(editor: Editor, videoId: string): boolean {
  if (!isYouTubeVideoId(videoId)) return false
  return editor
    .chain()
    .focus()
    .insertContent([
      { type: 'youtubeVideo', attrs: { videoId, alignment: 'center' } },
      { type: 'paragraph' },
    ])
    .run()
}
