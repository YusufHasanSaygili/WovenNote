import { basename } from 'node:path'

import type {
  ExportNoteInput,
  ExportNoteOutcome,
  NoteExportFormat,
} from '../../shared/schemas/export-contracts'
import type { NoteRepository } from '../repositories/note-repository'
import type { Note } from '../../shared/schemas/note-contracts'
import { serializeNote } from './note-export-serializer'

interface SaveDestinationOptions {
  readonly defaultFileName: string
  readonly extensions: readonly string[]
  readonly formatName: string
}

export interface NoteExportServiceDependencies {
  readonly chooseDestination: (
    options: SaveDestinationOptions,
  ) => Promise<{ readonly cancelled: boolean; readonly filePath?: string }>
  readonly now?: () => Date
  readonly renderPdf?: (note: Note) => Promise<Buffer>
  readonly writeFile: (filePath: string, content: string | Buffer) => Promise<void>
}

const formatOptions: Record<
  NoteExportFormat,
  { readonly extension: string; readonly formatName: string }
> = {
  markdown: { extension: 'md', formatName: 'Markdown' },
  txt: { extension: 'txt', formatName: 'Düz metin' },
  json: { extension: 'json', formatName: 'WovenNote JSON' },
  pdf: { extension: 'pdf', formatName: 'PDF belgesi' },
}

export function sanitizeExportFileName(title: string): string {
  const sanitized = title
    .trim()
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  const fallback = sanitized || 'Adsız not'
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(fallback) ? `not-${fallback}` : fallback
}

export class NoteExportService {
  private readonly now: () => Date

  constructor(
    private readonly repository: NoteRepository,
    private readonly dependencies: NoteExportServiceDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date())
  }

  async exportNote(input: ExportNoteInput): Promise<ExportNoteOutcome> {
    const note = this.repository.findById(input.noteId)
    if (!note || note.deletedAt) throw new Error('Note not found.')

    const options = formatOptions[input.format]
    const destination = await this.dependencies.chooseDestination({
      defaultFileName: `${sanitizeExportFileName(note.title)}.${options.extension}`,
      extensions: [options.extension],
      formatName: options.formatName,
    })
    if (destination.cancelled || !destination.filePath) return { status: 'cancelled' }

    const expectedSuffix = `.${options.extension}`
    const filePath = destination.filePath.toLocaleLowerCase('en-US').endsWith(expectedSuffix)
      ? destination.filePath
      : `${destination.filePath}${expectedSuffix}`
    const content =
      input.format === 'pdf'
        ? await this.renderPdf(note)
        : serializeNote(note, input.format, this.now().toISOString())
    await this.dependencies.writeFile(filePath, content)

    return {
      status: 'saved',
      format: input.format,
      fileName: basename(filePath),
      bytesWritten:
        typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.length,
    }
  }

  private async renderPdf(note: Note): Promise<Buffer> {
    if (!this.dependencies.renderPdf) throw new Error('PDF renderer is unavailable.')
    return this.dependencies.renderPdf(note)
  }
}
