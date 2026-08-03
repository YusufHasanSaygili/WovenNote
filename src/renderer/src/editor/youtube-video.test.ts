import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { insertYouTubeVideo, YouTubeVideoNode } from './youtube-video'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('YouTube video block', () => {
  it('inserts only a validated video id followed by an editable paragraph', () => {
    editor = new Editor({
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      extensions: [StarterKit, YouTubeVideoNode],
    })

    expect(insertYouTubeVideo(editor, 'M7lc1UVf-VE')).toBe(true)
    expect(editor.getJSON().content).toEqual([
      { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE', alignment: 'center' } },
      { type: 'paragraph' },
    ])
    expect(insertYouTubeVideo(editor, '../unsafe')).toBe(false)
  })
})
