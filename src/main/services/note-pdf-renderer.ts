import {
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
  type TiptapDocument,
} from '../../shared/schemas/editor-document'
import type { Note } from '../../shared/schemas/note-contracts'

type BlockNode = TiptapDocument['content'][number]
type ParagraphNode = Extract<BlockNode, { type: 'paragraph' }>
type TextNode = NonNullable<ParagraphNode['content']>[number]
type TextBlockAttributes = NonNullable<ParagraphNode['attrs']>

export interface NotePdfRendererDependencies {
  readonly printHtml: (html: string) => Promise<Buffer>
  readonly resolveImageDataUrl: (attachmentId: string) => Promise<string | null>
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function inlineHtml(content: readonly TextNode[] | undefined): string {
  return (
    content
      ?.map((node) => {
        let value = escapeHtml(node.text)
        for (const mark of node.marks ?? []) {
          if (mark.type === 'bold') value = `<strong>${value}</strong>`
          else if (mark.type === 'italic') value = `<em>${value}</em>`
          else if (mark.type === 'strike') value = `<s>${value}</s>`
          else if (mark.type === 'underline') value = `<u>${value}</u>`
          else if (mark.type === 'code') value = `<code>${value}</code>`
          else if (mark.type === 'link') {
            value = `<a href="${escapeHtml(mark.attrs.href)}">${value}</a>`
          } else if (mark.type === 'textStyle') {
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
      })
      .join('') ?? ''
  )
}

function blockLayoutAttribute(attributes: TextBlockAttributes | undefined): string {
  if (!attributes) return ''
  const styles = [
    attributes.textAlign ? `text-align: ${attributes.textAlign}` : null,
    attributes.lineHeight ? `line-height: ${attributes.lineHeight}` : null,
    attributes.indent ? `margin-left: ${attributes.indent * 2}rem` : null,
  ].filter((style): style is string => style !== null)
  return styles.length > 0 ? ` style="${styles.join('; ')}"` : ''
}

function blockHtml(node: BlockNode, imageDataUrls: ReadonlyMap<string, string>): string {
  switch (node.type) {
    case 'paragraph':
      return `<p${blockLayoutAttribute(node.attrs)}>${inlineHtml(node.content) || '<br>'}</p>`
    case 'heading':
      return `<h${node.attrs.level}${blockLayoutAttribute(node.attrs)}>${inlineHtml(node.content)}</h${node.attrs.level}>`
    case 'blockquote':
      return `<blockquote>${node.content.map((child) => blockHtml(child, imageDataUrls)).join('')}</blockquote>`
    case 'codeBlock':
      return `<pre><code>${escapeHtml(node.content?.map((child) => child.text).join('') ?? '')}</code></pre>`
    case 'horizontalRule':
      return '<hr>'
    case 'attachmentImage': {
      const source = imageDataUrls.get(node.attrs.attachmentId)
      if (!source) {
        return `<aside class="missing-media">Görsel kullanılamıyor: ${escapeHtml(node.attrs.alt || node.attrs.attachmentId)}</aside>`
      }
      return `<figure class="image-${node.attrs.alignment}" style="width: ${node.attrs.width}%"><img alt="${escapeHtml(node.attrs.alt)}" src="${source}"></figure>`
    }
    case 'attachmentVideo':
      return '<aside class="media-reference">Video eki PDF içine gömülmedi.</aside>'
    case 'attachmentFile':
      return `<aside class="media-reference">Dosya eki: ${escapeHtml(node.attrs.attachmentId)}</aside>`
    case 'youtubeVideo':
      return `<aside class="media-reference">YouTube videosu: <a href="https://www.youtube.com/watch?v=${node.attrs.videoId}">https://www.youtube.com/watch?v=${node.attrs.videoId}</a></aside>`
    case 'bulletList':
      return `<ul>${node.content.map((item) => `<li>${item.content.map((child) => blockHtml(child, imageDataUrls)).join('')}</li>`).join('')}</ul>`
    case 'orderedList':
      return `<ol start="${node.attrs.start}">${node.content.map((item) => `<li>${item.content.map((child) => blockHtml(child, imageDataUrls)).join('')}</li>`).join('')}</ol>`
    case 'taskList':
      return `<ul class="task-list">${node.content.map((item) => `<li><span class="checkbox" aria-hidden="true">${item.attrs.checked ? '☒' : '☐'}</span>${item.content.map((child) => blockHtml(child, imageDataUrls)).join('')}</li>`).join('')}</ul>`
    case 'table': {
      const rows = node.content.map(
        (row) =>
          `<tr>${row.content
            .map((cell) => {
              const tag = cell.type === 'tableHeader' ? 'th' : 'td'
              return `<${tag}>${cell.content.map((child) => blockHtml(child, imageDataUrls)).join('')}</${tag}>`
            })
            .join('')}</tr>`,
      )
      const hasHeader =
        node.content[0]?.content.some((cell) => cell.type === 'tableHeader') ?? false
      return hasHeader
        ? `<table><thead>${rows[0]}</thead><tbody>${rows.slice(1).join('')}</tbody></table>`
        : `<table><tbody>${rows.join('')}</tbody></table>`
    }
  }
}

export function collectPdfImageAttachmentIds(document: TiptapDocument): string[] {
  return [
    ...new Set(
      document.content
        .filter((node): node is Extract<BlockNode, { type: 'attachmentImage' }> =>
          Boolean(node.type === 'attachmentImage'),
        )
        .map((node) => node.attrs.attachmentId),
    ),
  ]
}

export function createNotePdfHtml(note: Note, imageDataUrls: ReadonlyMap<string, string>): string {
  const document = TiptapDocumentSchema.parse(parseEditorEnvelopeJson(note.contentJson).content)
  const body = document.content.map((node) => blockHtml(node, imageDataUrls)).join('')
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
  <title>${escapeHtml(note.title)}</title>
  <style>
    @page { size: A4; margin: 18mm 17mm 20mm; }
    * { box-sizing: border-box; }
    html { color: #172033; background: #fff; font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.55; }
    body { margin: 0; overflow-wrap: anywhere; }
    .document-title { margin: 0 0 8mm; font-size: 25pt; line-height: 1.15; }
    h1, h2, h3 { break-after: avoid-page; line-height: 1.25; margin: 1.2em 0 .45em; }
    h1 { font-size: 21pt; } h2 { font-size: 17pt; } h3 { font-size: 13.5pt; }
    p { margin: .45em 0; white-space: pre-wrap; }
    blockquote { border-left: 3px solid #8792a8; color: #3f4b61; margin: 1em 0; padding: .25em 1em; }
    pre { break-inside: avoid-page; background: #f2f4f8; border: 1px solid #d9deea; border-radius: 6px; padding: 10px; white-space: pre-wrap; }
    code { font-family: Consolas, "Courier New", monospace; }
    ul, ol { padding-left: 1.65em; } li { break-inside: avoid-page; margin: .25em 0; }
    li > p { display: inline; }
    .task-list { list-style: none; padding-left: .15em; } .checkbox { display: inline-block; margin-right: .45em; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1em 0; }
    thead { display: table-header-group; } tr { break-inside: avoid-page; }
    th, td { border: 1px solid #aeb7c8; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eef1f6; font-weight: 650; } th p, td p { margin: 0; }
    figure { break-inside: avoid-page; margin: 1em 0; max-width: 100%; }
    figure.image-left { margin-right: auto; } figure.image-center { margin-left: auto; margin-right: auto; } figure.image-right { margin-left: auto; }
    img { display: block; width: 100%; max-width: 100%; height: auto; object-fit: contain; }
    .missing-media, .media-reference { break-inside: avoid-page; border: 1px dashed #aeb7c8; color: #59647a; margin: 1em 0; padding: 9px 11px; }
    a { color: #3447b8; text-decoration: underline; }
    hr { border: 0; border-top: 1px solid #aeb7c8; margin: 1.4em 0; }
  </style>
</head>
<body>
  <h1 class="document-title">${escapeHtml(note.title)}</h1>
  ${body}
</body>
</html>`
}

export function validatePdfBuffer(pdf: Buffer): Buffer {
  const header = pdf.subarray(0, 5).toString('ascii')
  const tail = pdf.subarray(Math.max(0, pdf.length - 1_024)).toString('ascii')
  if (pdf.length < 100 || header !== '%PDF-' || !tail.includes('%%EOF')) {
    throw new Error('Generated PDF is invalid.')
  }
  return pdf
}

export class NotePdfRenderer {
  constructor(private readonly dependencies: NotePdfRendererDependencies) {}

  async render(note: Note): Promise<Buffer> {
    const document = TiptapDocumentSchema.parse(parseEditorEnvelopeJson(note.contentJson).content)
    const imageEntries = await Promise.all(
      collectPdfImageAttachmentIds(document).map(
        async (attachmentId) =>
          [attachmentId, await this.dependencies.resolveImageDataUrl(attachmentId)] as const,
      ),
    )
    const imageDataUrls = new Map(
      imageEntries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
    )
    const html = createNotePdfHtml(note, imageDataUrls)
    return validatePdfBuffer(await this.dependencies.printHtml(html))
  }
}
