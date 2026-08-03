// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import type { Note } from '../../shared/schemas/note-contracts'
import {
  collectPdfImageAttachmentIds,
  createNotePdfHtml,
  NotePdfRenderer,
  validatePdfBuffer,
} from './note-pdf-renderer'

function pdfNote(): Note {
  return {
    id: 'pdf-note-001',
    title: 'Plan <2026>',
    preview: '',
    searchText: '',
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: null },
            content: [{ type: 'text', text: 'Özet' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Madde' }] }],
              },
            ],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Başlık' }] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'attachmentImage',
            attrs: {
              attachmentId: 'image-pdf-001',
              alt: 'Oranlı görsel',
              alignment: 'right',
              width: 50,
            },
          },
          { type: 'attachmentVideo', attrs: { attachmentId: 'video-pdf-001' } },
          { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE' } },
        ],
      },
    }),
    color: '#fff4bd',
    gridX: 0,
    gridY: 0,
    gridWidth: 3,
    gridHeight: 4,
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    deletedAt: null,
    lastOpenedAt: null,
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T11:00:00.000Z',
  }
}

function validPdf(): Buffer {
  return Buffer.from(`%PDF-1.7\n${'0'.repeat(120)}\n%%EOF`, 'ascii')
}

describe('note PDF renderer', () => {
  it('creates paged print HTML for headings, lists, tables and aspect-safe images', () => {
    const note = pdfNote()
    const document = JSON.parse(note.contentJson).content
    expect(collectPdfImageAttachmentIds(document)).toEqual(['image-pdf-001'])

    const html = createNotePdfHtml(
      note,
      new Map([['image-pdf-001', 'data:image/png;base64,iVBORw0KGgo=']]),
    )

    expect(html).toContain('<title>Plan &lt;2026&gt;</title>')
    expect(html).toContain('<h2>Özet</h2>')
    expect(html).toContain('<ul><li><p>Madde</p></li></ul>')
    expect(html).toContain('<thead><tr><th><p>Başlık</p></th></tr></thead>')
    expect(html).toContain('class="image-right" style="width: 50%"')
    expect(html).toContain('height: auto; object-fit: contain')
    expect(html).toContain('@page { size: A4;')
    expect(html).toContain('break-inside: avoid-page')
    expect(html).toContain('Video eki PDF içine gömülmedi.')
    expect(html).toContain('https://www.youtube.com/watch?v=M7lc1UVf-VE')
    expect(html).not.toContain('<script')
  })

  it('preserves safe font, point, alignment, line spacing, and indentation in print HTML', () => {
    const note = {
      ...pdfNote(),
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: { textAlign: 'center', lineHeight: '1.5', indent: 2 },
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

    const html = createNotePdfHtml(note, new Map())
    expect(html).toContain(
      '<p style="text-align: center; line-height: 1.5; margin-left: 4rem"><span style="color: #1d4ed8; font-family: Georgia; font-size: 18pt">Biçimli</span></p>',
    )
  })

  it('escapes note-controlled HTML and link attributes in print output', () => {
    const note = {
      ...pdfNote(),
      title: '</title><script>globalThis.compromised=true</script>',
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
                  text: '</style><img src=x onerror=alert(1)>',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://example.com/?q=%22%3E%3Cscript%3E',
                        target: '_blank',
                        rel: 'noopener noreferrer nofollow',
                        class: null,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    }

    const html = createNotePdfHtml(note, new Map())

    expect(html).toContain('&lt;/title&gt;&lt;script&gt;globalThis.compromised=true&lt;/script&gt;')
    expect(html).toContain('&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<script>globalThis.compromised')
    expect(html).not.toContain('<img src=x')
  })

  it('resolves only referenced images and validates the generated PDF', async () => {
    const resolveImageDataUrl = vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo=')
    const printHtml = vi.fn(async () => validPdf())
    const renderer = new NotePdfRenderer({ resolveImageDataUrl, printHtml })

    await expect(renderer.render(pdfNote())).resolves.toEqual(validPdf())
    expect(resolveImageDataUrl).toHaveBeenCalledWith('image-pdf-001')
    expect(resolveImageDataUrl).not.toHaveBeenCalledWith('video-pdf-001')
    expect(printHtml).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64'))
  })

  it('rejects malformed print output instead of writing a corrupt PDF', async () => {
    expect(() => validatePdfBuffer(Buffer.from('not a pdf'))).toThrow('Generated PDF is invalid.')
    const renderer = new NotePdfRenderer({
      resolveImageDataUrl: async () => null,
      printHtml: async () => Buffer.from('%PDF-broken'),
    })
    await expect(renderer.render(pdfNote())).rejects.toThrow('Generated PDF is invalid.')
  })
})
