// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { NoteExportFileSchema } from '../../shared/schemas/export-contracts'
import type { Note } from '../../shared/schemas/note-contracts'
import {
  serializeNoteAsMarkdown,
  serializeNoteAsText,
  serializeNote,
} from './note-export-serializer'

function exportableNote(): Note {
  return {
    id: 'export-note-001',
    title: 'Ürün *planı*',
    preview: 'Başlangıç',
    searchText: 'Başlangıç görev',
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: null },
            content: [{ type: 'text', text: 'Başlangıç', marks: [{ type: 'bold' }] }],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Görev' }] }],
              },
            ],
          },
          {
            type: 'attachmentImage',
            attrs: {
              attachmentId: 'image-001',
              alt: 'Mimari çizim',
              alignment: 'center',
              width: 50,
            },
          },
          { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE' } },
        ],
      },
    }),
    color: '#fff4bd',
    gridX: 1,
    gridY: 2,
    gridWidth: 4,
    gridHeight: 3,
    isPinned: true,
    isFavorite: false,
    isArchived: false,
    deletedAt: null,
    lastOpenedAt: null,
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T11:00:00.000Z',
    tags: [
      {
        id: 'tag-001',
        name: 'Plan',
        color: '#5364d8',
        createdAt: '2026-07-28T10:30:00.000Z',
      },
    ],
  }
}

describe('note export serializers', () => {
  it('preserves document structure and path-free attachment references in Markdown', () => {
    const markdown = serializeNoteAsMarkdown(exportableNote())

    expect(markdown).toContain('# Ürün \\*planı\\*')
    expect(markdown).toContain('## **Başlangıç**')
    expect(markdown).toContain('- [x] Görev')
    expect(markdown).toContain('![Mimari çizim](attachmentId:image-001)')
    expect(markdown).toContain('[YouTube videosu](https://www.youtube.com/watch?v=M7lc1UVf-VE)')
    expect(markdown).not.toMatch(/[A-Z]:\\/)
  })

  it('creates readable plain text with structural markers', () => {
    const text = serializeNoteAsText(exportableNote())

    expect(text).toContain('Ürün *planı*\n\nBaşlangıç')
    expect(text).toContain('[x] Görev')
    expect(text).toContain('Mimari çizim [attachmentId:image-001]')
    expect(text).toContain('YouTube videosu [https://www.youtube.com/watch?v=M7lc1UVf-VE]')
  })

  it('preserves allowlisted font and point formatting in Markdown HTML spans', () => {
    const note = {
      ...exportableNote(),
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Biçimli',
                  marks: [
                    {
                      type: 'textStyle',
                      attrs: { color: '#1d4ed8', fontFamily: 'Georgia', fontSize: '18pt' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    }

    expect(serializeNoteAsMarkdown(note)).toContain(
      '<span style="color: #1d4ed8; font-family: Georgia; font-size: 18pt">Biçimli</span>',
    )
  })

  it('creates a strict, versioned JSON document without derived or secret fields', () => {
    const json = serializeNote(exportableNote(), 'json', '2026-07-28T12:00:00.000Z')
    const parsed = NoteExportFileSchema.parse(JSON.parse(json))

    expect(parsed).toMatchObject({
      format: 'wovennote-note',
      exportVersion: 1,
      note: { id: 'export-note-001', title: 'Ürün *planı*' },
    })
    expect(parsed.note.document).toMatchObject({ documentVersion: 1, editor: 'tiptap' })
    expect(json).not.toContain('searchText')
    expect(json).not.toContain('contentJson')
    expect(json).not.toContain('apiKey')
  })
})
