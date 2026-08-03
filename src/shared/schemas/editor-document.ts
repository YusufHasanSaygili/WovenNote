import { z } from 'zod'

export const EDITOR_TEXT_COLORS = [
  '#172033',
  '#b42318',
  '#c2410c',
  '#047857',
  '#1d4ed8',
  '#7e22ce',
] as const

export const EDITOR_HIGHLIGHT_COLORS = [
  '#fef3c7',
  '#fee2e2',
  '#dcfce7',
  '#dbeafe',
  '#f3e8ff',
] as const

export const EDITOR_FONT_FAMILIES = [
  'Aptos',
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Courier New',
] as const

export const EDITOR_FONT_SIZES = [
  '8pt',
  '9pt',
  '10pt',
  '11pt',
  '12pt',
  '14pt',
  '16pt',
  '18pt',
  '20pt',
  '24pt',
  '28pt',
  '32pt',
  '36pt',
  '48pt',
  '72pt',
] as const

export const EDITOR_LINE_HEIGHTS = ['1', '1.15', '1.5', '2'] as const
export const EDITOR_INDENT_LEVELS = [0, 1, 2, 3, 4] as const

const EditorIndentLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])

function isSafeEditorLinkHref(href: string): boolean {
  if (/[%](?:0a|0d)/i.test(href) || /[\r\n]/.test(href)) return false
  try {
    const url = new URL(href)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.username === '' && url.password === ''
    }
    return (
      url.protocol === 'mailto:' &&
      url.pathname.length <= 320 &&
      /^[^\s@]+@[^\s@]+$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

const MarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }).strict(),
  z.object({ type: z.literal('italic') }).strict(),
  z.object({ type: z.literal('underline') }).strict(),
  z.object({ type: z.literal('strike') }).strict(),
  z.object({ type: z.literal('code') }).strict(),
  z
    .object({
      type: z.literal('textStyle'),
      attrs: z
        .object({
          color: z.enum(EDITOR_TEXT_COLORS).nullable().optional(),
          fontFamily: z.enum(EDITOR_FONT_FAMILIES).nullable().optional(),
          fontSize: z.enum(EDITOR_FONT_SIZES).nullable().optional(),
        })
        .strict()
        .refine((attrs) => attrs.color || attrs.fontFamily || attrs.fontSize),
    })
    .strict(),
  z
    .object({
      type: z.literal('highlight'),
      attrs: z.object({ color: z.enum(EDITOR_HIGHLIGHT_COLORS) }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('link'),
      attrs: z
        .object({
          href: z.string().max(2_048).refine(isSafeEditorLinkHref),
          target: z.union([z.literal('_blank'), z.null()]),
          rel: z.union([z.literal('noopener noreferrer nofollow'), z.null()]),
          class: z.null(),
        })
        .strict(),
    })
    .strict(),
])

const TextNodeSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
    marks: z.array(MarkSchema).max(32).optional(),
  })
  .strict()
const InlineContentSchema = z.array(TextNodeSchema).optional()

const TextAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']).nullable()
const TextBlockLayoutAttributesSchema = z
  .object({
    textAlign: TextAlignmentSchema.optional(),
    lineHeight: z.enum(EDITOR_LINE_HEIGHTS).nullable().optional(),
    indent: EditorIndentLevelSchema.optional(),
  })
  .strict()

const ParagraphNodeSchema = z
  .object({
    type: z.literal('paragraph'),
    attrs: TextBlockLayoutAttributesSchema.optional(),
    content: InlineContentSchema,
  })
  .strict()

const HeadingNodeSchema = z
  .object({
    type: z.literal('heading'),
    attrs: z
      .object({
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        textAlign: TextAlignmentSchema.optional(),
        lineHeight: z.enum(EDITOR_LINE_HEIGHTS).nullable().optional(),
        indent: EditorIndentLevelSchema.optional(),
      })
      .strict(),
    content: InlineContentSchema,
  })
  .strict()

const TextBlockSchema = z.union([ParagraphNodeSchema, HeadingNodeSchema])

const BlockquoteNodeSchema = z
  .object({ type: z.literal('blockquote'), content: z.array(TextBlockSchema).min(1) })
  .strict()

const CodeBlockNodeSchema = z
  .object({
    type: z.literal('codeBlock'),
    attrs: z.object({ language: z.string().nullable() }).strict(),
    content: z.array(TextNodeSchema).optional(),
  })
  .strict()

const HorizontalRuleNodeSchema = z.object({ type: z.literal('horizontalRule') }).strict()

const AttachmentImageNodeSchema = z
  .object({
    type: z.literal('attachmentImage'),
    attrs: z
      .object({
        attachmentId: z.string().min(1).max(100),
        alt: z.string().max(500),
        alignment: z.enum(['left', 'center', 'right']),
        width: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
      })
      .strict(),
  })
  .strict()

const AttachmentReferenceAttributesSchema = z
  .object({ attachmentId: z.string().min(1).max(100) })
  .strict()

const AttachmentVideoNodeSchema = z
  .object({
    type: z.literal('attachmentVideo'),
    attrs: z
      .object({
        attachmentId: z.string().min(1).max(100),
        alignment: z.enum(['left', 'center', 'right']).default('center'),
      })
      .strict(),
  })
  .strict()

const AttachmentFileNodeSchema = z
  .object({ type: z.literal('attachmentFile'), attrs: AttachmentReferenceAttributesSchema })
  .strict()

const YouTubeVideoNodeSchema = z
  .object({
    type: z.literal('youtubeVideo'),
    attrs: z
      .object({
        videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
        alignment: z.enum(['left', 'center', 'right']).default('center'),
      })
      .strict(),
  })
  .strict()

const ListItemNodeSchema = z
  .object({ type: z.literal('listItem'), content: z.array(TextBlockSchema).min(1) })
  .strict()

const BulletListNodeSchema = z
  .object({ type: z.literal('bulletList'), content: z.array(ListItemNodeSchema).min(1) })
  .strict()

const OrderedListNodeSchema = z
  .object({
    type: z.literal('orderedList'),
    attrs: z.object({ start: z.number().int().positive(), type: z.string().nullable() }).strict(),
    content: z.array(ListItemNodeSchema).min(1),
  })
  .strict()

const TaskItemNodeSchema = z
  .object({
    type: z.literal('taskItem'),
    attrs: z.object({ checked: z.boolean() }).strict(),
    content: z.array(TextBlockSchema).min(1),
  })
  .strict()

const TaskListNodeSchema = z
  .object({ type: z.literal('taskList'), content: z.array(TaskItemNodeSchema).min(1) })
  .strict()

const TableCellAttributesSchema = z
  .object({
    colspan: z.number().int().min(1).max(20),
    rowspan: z.number().int().min(1).max(100),
    colwidth: z.array(z.number().int().positive()).max(20).nullable(),
    align: z.null(),
  })
  .strict()

const TableCellContentSchema = z
  .array(
    z.union([
      TextBlockSchema,
      BlockquoteNodeSchema,
      CodeBlockNodeSchema,
      BulletListNodeSchema,
      OrderedListNodeSchema,
      TaskListNodeSchema,
    ]),
  )
  .min(1)

const TableCellNodeSchema = z
  .object({
    type: z.literal('tableCell'),
    attrs: TableCellAttributesSchema,
    content: TableCellContentSchema,
  })
  .strict()

const TableHeaderNodeSchema = z
  .object({
    type: z.literal('tableHeader'),
    attrs: TableCellAttributesSchema,
    content: TableCellContentSchema,
  })
  .strict()

const TableRowNodeSchema = z
  .object({
    type: z.literal('tableRow'),
    content: z
      .array(z.union([TableCellNodeSchema, TableHeaderNodeSchema]))
      .min(1)
      .max(100),
  })
  .strict()

const TableNodeSchema = z
  .object({
    type: z.literal('table'),
    content: z.array(TableRowNodeSchema).min(1).max(100),
  })
  .strict()

const BlockNodeSchema = z.union([
  TextBlockSchema,
  BlockquoteNodeSchema,
  CodeBlockNodeSchema,
  HorizontalRuleNodeSchema,
  AttachmentImageNodeSchema,
  AttachmentVideoNodeSchema,
  AttachmentFileNodeSchema,
  YouTubeVideoNodeSchema,
  BulletListNodeSchema,
  OrderedListNodeSchema,
  TaskListNodeSchema,
  TableNodeSchema,
])

export const TiptapDocumentSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(BlockNodeSchema).max(10_000),
  })
  .strict()

const LegacyEmptyContentSchema = z.object({}).strict()

export const EditorDocumentEnvelopeSchema = z
  .object({
    documentVersion: z.literal(1),
    editor: z.literal('tiptap'),
    content: z.union([TiptapDocumentSchema, LegacyEmptyContentSchema]),
  })
  .strict()

export type EditorDocumentEnvelope = z.infer<typeof EditorDocumentEnvelopeSchema>
export type TiptapDocument = z.infer<typeof TiptapDocumentSchema>

export const EMPTY_TIPTAP_DOCUMENT: TiptapDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function normalizeEditorEnvelope(value: unknown): EditorDocumentEnvelope {
  const parsed = EditorDocumentEnvelopeSchema.safeParse(value)
  if (!parsed.success || !('type' in parsed.data.content)) {
    return { documentVersion: 1, editor: 'tiptap', content: EMPTY_TIPTAP_DOCUMENT }
  }

  return parsed.data
}

export function parseEditorEnvelopeJson(contentJson: string): EditorDocumentEnvelope {
  try {
    return normalizeEditorEnvelope(JSON.parse(contentJson))
  } catch {
    return { documentVersion: 1, editor: 'tiptap', content: EMPTY_TIPTAP_DOCUMENT }
  }
}

export function editorDocumentPlainText(document: TiptapDocument): string {
  const nodeText = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const record = node as Record<string, unknown>
    if (record['type'] === 'text' && typeof record['text'] === 'string') return record['text']
    if (!Array.isArray(record['content'])) return ''
    return record['content'].map(nodeText).join(record['type'] === 'doc' ? '\n' : '')
  }

  return document.content.map(nodeText).join('\n').trim()
}
