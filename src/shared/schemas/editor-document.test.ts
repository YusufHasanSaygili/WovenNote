import { describe, expect, it } from 'vitest'

import {
  EditorDocumentEnvelopeSchema,
  editorDocumentPlainText,
  normalizeEditorEnvelope,
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
} from './editor-document'

describe('editor document envelope', () => {
  it('normalizes legacy empty and malformed content to an empty Tiptap document', () => {
    expect(
      normalizeEditorEnvelope({ documentVersion: 1, editor: 'tiptap', content: {} }).content,
    ).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(parseEditorEnvelopeJson('not-json').content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
  })

  it('extracts plain text from paragraphs and H1/H2/H3 blocks', () => {
    expect(
      editorDocumentPlainText({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Başlık' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Gövde metni' }] },
        ],
      }),
    ).toBe('Başlık\nGövde metni')
  })

  it('allows only the rich text marks and list block structures from SLICE-010', () => {
    const document = {
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Kalın', marks: [{ type: 'bold' }] },
              {
                type: 'text',
                text: ' bağlantı',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://example.com/',
                      target: '_blank',
                      rel: 'noopener noreferrer nofollow',
                      class: null,
                    },
                  },
                ],
              },
            ],
          },
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
        ],
      },
    }

    expect(EditorDocumentEnvelopeSchema.safeParse(document).success).toBe(true)
    expect(
      EditorDocumentEnvelopeSchema.safeParse({
        ...document,
        content: { type: 'doc', content: [{ type: 'table' }] },
      }).success,
    ).toBe(false)
  })

  it('rejects executable, credential-bearing and header-injection link attributes', () => {
    const linkDocument = (attrs: Record<string, unknown>) => ({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bağlantı', marks: [{ type: 'link', attrs }] }],
          },
        ],
      },
    })
    const safeAttributes = {
      href: 'https://example.com/path?q=1',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
      class: null,
    }

    expect(EditorDocumentEnvelopeSchema.safeParse(linkDocument(safeAttributes)).success).toBe(true)
    expect(
      EditorDocumentEnvelopeSchema.safeParse(
        linkDocument({ ...safeAttributes, href: 'javascript:alert(1)' }),
      ).success,
    ).toBe(false)
    expect(
      EditorDocumentEnvelopeSchema.safeParse(
        linkDocument({ ...safeAttributes, href: 'https://user:secret@example.com/' }),
      ).success,
    ).toBe(false)
    expect(
      EditorDocumentEnvelopeSchema.safeParse(
        linkDocument({
          ...safeAttributes,
          href: 'mailto:test@example.com?subject=%0d%0aBcc:x@y.z',
        }),
      ).success,
    ).toBe(false)
    expect(
      EditorDocumentEnvelopeSchema.safeParse(linkDocument({ ...safeAttributes, target: '_self' }))
        .success,
    ).toBe(false)
  })

  it('accepts an attachmentId-only image block and rejects path injection', () => {
    const imageDocument = {
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Önce' }] },
          {
            type: 'attachmentImage',
            attrs: {
              attachmentId: 'attachment-001',
              alt: 'Örnek görsel',
              alignment: 'center',
              width: 50,
            },
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Sonra' }] },
        ],
      },
    }

    expect(EditorDocumentEnvelopeSchema.safeParse(imageDocument).success).toBe(true)
    expect(
      EditorDocumentEnvelopeSchema.safeParse({
        ...imageDocument,
        content: {
          type: 'doc',
          content: [
            {
              ...imageDocument.content.content[1],
              attrs: {
                ...imageDocument.content.content[1]?.attrs,
                src: 'file:///C:/private/image.png',
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('accepts aligned video and attachmentId-only file blocks', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'attachmentVideo', attrs: { attachmentId: 'video-001', alignment: 'right' } },
        { type: 'attachmentFile', attrs: { attachmentId: 'file-001' } },
      ],
    }

    expect(
      EditorDocumentEnvelopeSchema.safeParse({
        documentVersion: 1,
        editor: 'tiptap',
        content,
      }).success,
    ).toBe(true)
    expect(
      EditorDocumentEnvelopeSchema.safeParse({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'attachmentFile',
              attrs: { attachmentId: 'file-001', url: 'https://example.com' },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('accepts only a strict YouTube video id and media alignment in an embedded video block', () => {
    const documentWithVideoId = (videoId: string, alignment = 'left') => ({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [{ type: 'youtubeVideo', attrs: { videoId, alignment } }],
      },
    })

    expect(EditorDocumentEnvelopeSchema.safeParse(documentWithVideoId('M7lc1UVf-VE')).success).toBe(
      true,
    )
    expect(
      EditorDocumentEnvelopeSchema.safeParse(documentWithVideoId('../M7lc1UVf-VE<script>')).success,
    ).toBe(false)
    expect(
      EditorDocumentEnvelopeSchema.safeParse(documentWithVideoId('M7lc1UVf-VE', 'wide')).success,
    ).toBe(false)
    expect(
      EditorDocumentEnvelopeSchema.safeParse({
        ...documentWithVideoId('M7lc1UVf-VE'),
        content: {
          type: 'doc',
          content: [
            {
              type: 'youtubeVideo',
              attrs: { videoId: 'M7lc1UVf-VE', src: 'https://attacker.example/' },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('defaults legacy video blocks without alignment to center', () => {
    const parsed = EditorDocumentEnvelopeSchema.parse({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          { type: 'attachmentVideo', attrs: { attachmentId: 'legacy-video' } },
          { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE' } },
        ],
      },
    })

    expect(parsed.content.content).toEqual([
      { type: 'attachmentVideo', attrs: { attachmentId: 'legacy-video', alignment: 'center' } },
      { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE', alignment: 'center' } },
    ])
  })

  it('accepts allowlisted Word-style formatting and rejects arbitrary CSS values', () => {
    const formatted = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'justify', lineHeight: '1.5', indent: 2 },
          content: [
            {
              type: 'text',
              text: 'Biçimli',
              marks: [
                {
                  type: 'textStyle',
                  attrs: { color: '#172033', fontFamily: 'Georgia', fontSize: '18pt' },
                },
              ],
            },
          ],
        },
      ],
    }

    expect(TiptapDocumentSchema.safeParse(formatted).success).toBe(true)
    expect(
      TiptapDocumentSchema.safeParse({
        ...formatted,
        content: [
          {
            ...formatted.content[0],
            content: [
              {
                ...formatted.content[0]?.content[0],
                marks: [
                  {
                    type: 'textStyle',
                    attrs: { fontFamily: 'url(javascript:1)', fontSize: '999pt' },
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false)
  })
})
