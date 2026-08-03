import {
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
  type TiptapDocument,
} from '../../shared/schemas/editor-document'
import {
  NoteExportFileSchema,
  type NoteExportFile,
  type NoteExportFormat,
} from '../../shared/schemas/export-contracts'
import type { Note } from '../../shared/schemas/note-contracts'

type BlockNode = TiptapDocument['content'][number]
type ParagraphNode = Extract<BlockNode, { type: 'paragraph' }>
type TextNode = NonNullable<ParagraphNode['content']>[number]

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]<>])/g, '\\$1')
}

function markdownText(node: TextNode): string {
  let value = escapeMarkdown(node.text)

  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = `**${value}**`
    else if (mark.type === 'italic') value = `_${value}_`
    else if (mark.type === 'strike') value = `~~${value}~~`
    else if (mark.type === 'underline') value = `<u>${value}</u>`
    else if (mark.type === 'code') {
      const fence = node.text.includes('`') ? '``' : '`'
      value = `${fence}${node.text}${fence}`
    } else if (mark.type === 'link') value = `[${value}](${mark.attrs.href})`
    else if (mark.type === 'textStyle') {
      const styles = [
        mark.attrs.color ? `color: ${mark.attrs.color}` : null,
        mark.attrs.fontFamily ? `font-family: ${mark.attrs.fontFamily}` : null,
        mark.attrs.fontSize ? `font-size: ${mark.attrs.fontSize}` : null,
      ].filter((style): style is string => style !== null)
      if (styles.length > 0) value = `<span style="${styles.join('; ')}">${value}</span>`
    } else if (mark.type === 'highlight') {
      value = `<mark style="background-color: ${mark.attrs.color}">${value}</mark>`
    }
  }

  return value
}

function markdownInline(content: readonly TextNode[] | undefined): string {
  return content?.map(markdownText).join('') ?? ''
}

function plainInline(content: readonly TextNode[] | undefined): string {
  return content?.map((node) => node.text).join('') ?? ''
}

function indentContinuation(value: string, prefix: string): string {
  return value.replaceAll('\n', `\n${' '.repeat(prefix.length)}`)
}

function markdownBlock(node: BlockNode): string {
  switch (node.type) {
    case 'paragraph':
      return markdownInline(node.content)
    case 'heading':
      return `${'#'.repeat(node.attrs.level)} ${markdownInline(node.content)}`
    case 'blockquote':
      return node.content
        .map(markdownBlock)
        .join('\n\n')
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
    case 'codeBlock': {
      const code = plainInline(node.content)
      const fence = code.includes('```') ? '````' : '```'
      return `${fence}${node.attrs.language ?? ''}\n${code}\n${fence}`
    }
    case 'horizontalRule':
      return '---'
    case 'attachmentImage':
      return `![${escapeMarkdown(node.attrs.alt || 'Görsel eki')}](attachmentId:${encodeURIComponent(node.attrs.attachmentId)})`
    case 'attachmentVideo':
      return `[Video eki](attachmentId:${encodeURIComponent(node.attrs.attachmentId)})`
    case 'attachmentFile':
      return `[Dosya eki](attachmentId:${encodeURIComponent(node.attrs.attachmentId)})`
    case 'youtubeVideo':
      return `[YouTube videosu](https://www.youtube.com/watch?v=${node.attrs.videoId})`
    case 'bulletList':
      return node.content
        .map((item) => {
          const prefix = '- '
          return `${prefix}${indentContinuation(item.content.map(markdownBlock).join('\n'), prefix)}`
        })
        .join('\n')
    case 'orderedList':
      return node.content
        .map((item, index) => {
          const prefix = `${node.attrs.start + index}. `
          return `${prefix}${indentContinuation(item.content.map(markdownBlock).join('\n'), prefix)}`
        })
        .join('\n')
    case 'taskList':
      return node.content
        .map((item) => {
          const prefix = `- [${item.attrs.checked ? 'x' : ' '}] `
          return `${prefix}${indentContinuation(item.content.map(markdownBlock).join('\n'), prefix)}`
        })
        .join('\n')
    case 'table': {
      const rows = node.content.map((row) =>
        row.content.map((cell) => {
          const text = cell.content.map(plainBlock).join(' ').replaceAll('|', '\\|')
          return text.replaceAll('\n', ' ')
        }),
      )
      const columnCount = Math.max(...rows.map((row) => row.length))
      const normalizedRows = rows.map((row) => [
        ...row,
        ...Array.from({ length: columnCount - row.length }, () => ''),
      ])
      const header = normalizedRows[0] ?? []
      const body = normalizedRows.slice(1)
      return [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`),
      ].join('\n')
    }
  }
}

function plainBlock(node: BlockNode): string {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return plainInline(node.content)
    case 'blockquote':
      return node.content.map(plainBlock).join('\n')
    case 'codeBlock':
      return plainInline(node.content)
    case 'horizontalRule':
      return '---'
    case 'attachmentImage':
      return `${node.attrs.alt || 'Görsel eki'} [attachmentId:${node.attrs.attachmentId}]`
    case 'attachmentVideo':
      return `Video eki [attachmentId:${node.attrs.attachmentId}]`
    case 'attachmentFile':
      return `Dosya eki [attachmentId:${node.attrs.attachmentId}]`
    case 'youtubeVideo':
      return `YouTube videosu [https://www.youtube.com/watch?v=${node.attrs.videoId}]`
    case 'bulletList':
      return node.content.map((item) => `- ${item.content.map(plainBlock).join('\n  ')}`).join('\n')
    case 'orderedList':
      return node.content
        .map(
          (item, index) =>
            `${node.attrs.start + index}. ${item.content.map(plainBlock).join('\n   ')}`,
        )
        .join('\n')
    case 'taskList':
      return node.content
        .map(
          (item) =>
            `[${item.attrs.checked ? 'x' : ' '}] ${item.content.map(plainBlock).join('\n    ')}`,
        )
        .join('\n')
    case 'table':
      return node.content
        .map((row) => row.content.map((cell) => cell.content.map(plainBlock).join(' ')).join('\t'))
        .join('\n')
  }
}

function exportDocument(note: Note): TiptapDocument {
  return TiptapDocumentSchema.parse(parseEditorEnvelopeJson(note.contentJson).content)
}

export function serializeNoteAsMarkdown(note: Note): string {
  const body = exportDocument(note).content.map(markdownBlock).join('\n\n').trim()
  return `# ${escapeMarkdown(note.title)}${body ? `\n\n${body}` : ''}\n`
}

export function serializeNoteAsText(note: Note): string {
  const body = exportDocument(note).content.map(plainBlock).join('\n\n').trim()
  return `${note.title}${body ? `\n\n${body}` : ''}\n`
}

export function createNoteExportFile(note: Note, exportedAt: string): NoteExportFile {
  const document = parseEditorEnvelopeJson(note.contentJson)
  return NoteExportFileSchema.parse({
    format: 'wovennote-note',
    exportVersion: 1,
    exportedAt,
    note: {
      id: note.id,
      title: note.title,
      document,
      color: note.color,
      gridX: note.gridX,
      gridY: note.gridY,
      gridWidth: note.gridWidth,
      gridHeight: note.gridHeight,
      isPinned: note.isPinned,
      isFavorite: note.isFavorite,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags ?? [],
    },
  })
}

export function serializeNote(note: Note, format: NoteExportFormat, exportedAt: string): string {
  if (format === 'markdown') return serializeNoteAsMarkdown(note)
  if (format === 'txt') return serializeNoteAsText(note)
  if (format === 'pdf') throw new Error('PDF export requires the PDF renderer.')
  return `${JSON.stringify(createNoteExportFile(note, exportedAt), null, 2)}\n`
}
