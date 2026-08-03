import { Editor } from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AttachmentImageNode } from './attachment-image'
import { AttachmentVideo } from './attachment-media'
import {
  alignTopLevelMedia,
  autoScrollDuringBlockDrag,
  BlockDragDrop,
  mediaAlignmentAtPointer,
  moveTopLevelBlock,
} from './block-drag-drop'
import { YouTubeVideoNode } from './youtube-video'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function createEditor(): Editor {
  return new Editor({
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Bir' }] },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Görev' }] }],
            },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'İki' }] },
        {
          type: 'attachmentImage',
          attrs: { attachmentId: 'image-001', alt: '', alignment: 'center', width: 50 },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Son' }] },
      ],
    },
    extensions: [StarterKit, TaskList, TaskItem, AttachmentImageNode, BlockDragDrop],
  })
}

describe('block drag and drop', () => {
  it('moves media between paragraphs without changing block content', () => {
    editor = createEditor()

    expect(moveTopLevelBlock(editor.view, 3, 1)).toBe(true)
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
      'heading',
      'attachmentImage',
      'taskList',
      'heading',
      'paragraph',
    ])
    expect(editor.getJSON().content?.[1]).toMatchObject({
      attrs: { attachmentId: 'image-001' },
    })
    expect(editor.getJSON().content?.[2]).toMatchObject({
      content: [{ content: [{ content: [{ text: 'Görev' }] }] }],
    })
  })

  it('moves a whole task list below another heading in one transaction', () => {
    editor = createEditor()

    expect(moveTopLevelBlock(editor.view, 1, 2)).toBe(true)
    expect(
      editor
        .getJSON()
        .content?.slice(0, 3)
        .map((node) => node.type),
    ).toEqual(['heading', 'heading', 'taskList'])
  })

  it('scrolls a long editor near either drag edge and stays still in the middle', () => {
    const container = document.createElement('div')
    const surface = document.createElement('div')
    container.append(surface)
    Object.defineProperties(container, {
      clientHeight: { value: 400 },
      scrollHeight: { value: 1600 },
    })
    container.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 0, right: 600, width: 600, height: 400 }) as DOMRect
    const scrollBy = vi.fn()
    container.scrollBy = scrollBy

    expect(autoScrollDuringBlockDrag(surface, 120)).toBe(-1)
    expect(autoScrollDuringBlockDrag(surface, 480)).toBe(1)
    expect(autoScrollDuringBlockDrag(surface, 300)).toBe(0)
    expect(scrollBy).toHaveBeenNthCalledWith(1, { top: -36, behavior: 'auto' })
    expect(scrollBy).toHaveBeenNthCalledWith(2, { top: 36, behavior: 'auto' })
    expect(scrollBy).toHaveBeenCalledTimes(2)
  })

  it('maps a horizontal drag to left, center or right media alignment', () => {
    const surface = document.createElement('div')
    surface.getBoundingClientRect = () =>
      ({ top: 0, bottom: 500, left: 100, right: 1_000, width: 900, height: 500 }) as DOMRect

    expect(mediaAlignmentAtPointer(surface, 150)).toBe('left')
    expect(mediaAlignmentAtPointer(surface, 550)).toBe('center')
    expect(mediaAlignmentAtPointer(surface, 950)).toBe('right')
  })

  it('persists horizontal alignment for local and YouTube video blocks', () => {
    editor = new Editor({
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Önce' }] },
          { type: 'attachmentVideo', attrs: { attachmentId: 'video-001', alignment: 'center' } },
          { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE', alignment: 'center' } },
        ],
      },
      extensions: [StarterKit, AttachmentVideo, YouTubeVideoNode, BlockDragDrop],
    })

    expect(alignTopLevelMedia(editor.view, 1, 'left')).toBe(true)
    expect(alignTopLevelMedia(editor.view, 2, 'right')).toBe(true)
    expect(alignTopLevelMedia(editor.view, 0, 'right')).toBe(false)
    expect(editor.getJSON().content?.[1]?.attrs).toMatchObject({ alignment: 'left' })
    expect(editor.getJSON().content?.[2]?.attrs).toMatchObject({ alignment: 'right' })
  })
})
