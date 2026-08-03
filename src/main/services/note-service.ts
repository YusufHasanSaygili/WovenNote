import { randomUUID } from 'node:crypto'

import type {
  CreateNoteInput,
  Note,
  NoteIdInput,
  PermanentlyDeleteNoteInput,
  RenameNoteInput,
  SaveNoteContentInput,
  SearchNotesInput,
  UpdateNoteLayoutsInput,
} from '../../shared/schemas/note-contracts'
import { CreateNoteInputSchema } from '../../shared/schemas/note-contracts'
import {
  editorDocumentPlainText,
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
} from '../../shared/schemas/editor-document'
import type { TiptapDocument } from '../../shared/schemas/editor-document'
import type {
  ListNoteVersionsInput,
  NoteVersion,
  RestoreNoteVersionInput,
} from '../../shared/schemas/note-version-contracts'
import type { NoteRepository } from '../repositories/note-repository'
import type {
  NoteVersionReason,
  NoteVersionRepository,
} from '../repositories/note-version-repository'

const DEFAULT_CONTENT_JSON = JSON.stringify({
  documentVersion: 1,
  editor: 'tiptap',
  content: {},
})
const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1_000
const SIGNIFICANT_TEXT_CHANGE = 500

export interface NoteServiceDependencies {
  readonly cleanupAttachmentFiles?: (relativePaths: readonly string[]) => Promise<number>
  readonly createId?: () => string
  readonly createVersionId?: () => string
  readonly now?: () => Date
  readonly versionRepository?: NoteVersionRepository
}

export class NoteService {
  private readonly createId: () => string
  private readonly createVersionId: () => string
  private readonly cleanupAttachmentFiles: (relativePaths: readonly string[]) => Promise<number>
  private readonly now: () => Date
  private readonly versions: NoteVersionRepository | undefined

  constructor(
    private readonly repository: NoteRepository,
    dependencies: NoteServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID
    this.createVersionId = dependencies.createVersionId ?? randomUUID
    this.cleanupAttachmentFiles = dependencies.cleanupAttachmentFiles ?? (async () => 0)
    this.now = dependencies.now ?? (() => new Date())
    this.versions = dependencies.versionRepository
  }

  create(input: CreateNoteInput): Note {
    const timestamp = this.now().toISOString()
    const note: Note = {
      id: this.createId(),
      title: input.title,
      preview: '',
      searchText: '',
      contentJson: DEFAULT_CONTENT_JSON,
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
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.repository.insert(note)
    return note
  }

  createWithContent(title: string, inputDocument: TiptapDocument): Note {
    const validatedTitle = CreateNoteInputSchema.parse({ title }).title
    const document = TiptapDocumentSchema.parse(inputDocument)
    const timestamp = this.now().toISOString()
    const searchText = editorDocumentPlainText(document)
    const note: Note = {
      id: this.createId(),
      title: validatedTitle,
      preview: searchText.slice(0, 240),
      searchText,
      contentJson: JSON.stringify({ documentVersion: 1, editor: 'tiptap', content: document }),
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
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.repository.insert(note)
    return note
  }

  list(): Note[] {
    return this.repository.listActive()
  }

  listArchived(): Note[] {
    return this.repository.listArchived()
  }

  listTrashed(): Note[] {
    return this.repository.listTrashed()
  }

  search(input: SearchNotesInput): Note[] {
    return this.repository.searchActive(input.query)
  }

  open(input: NoteIdInput): Note {
    const opened = this.repository.markOpened(input.id, this.now().toISOString())
    if (!opened) throw new Error('Note not found.')

    return opened
  }

  rename(input: RenameNoteInput): Note {
    const updated = this.repository.updateTitle(input.id, input.title, this.now().toISOString())

    if (!updated) {
      throw new Error('Note not found.')
    }

    return updated
  }

  saveContent(input: SaveNoteContentInput): Note {
    const document = TiptapDocumentSchema.parse(input.document.content)
    const searchText = editorDocumentPlainText(document)
    const preview = searchText.slice(0, 240)
    const timestamp = this.now().toISOString()
    const current = this.repository.findById(input.id)
    if (!current || current.deletedAt || current.isArchived) throw new Error('Note not found.')
    const nextContentJson = JSON.stringify(input.document)
    this.checkpointBeforeSave(current, nextContentJson, timestamp)
    const saved = this.repository.saveContent({
      id: input.id,
      title: input.title,
      contentJson: nextContentJson,
      preview,
      searchText,
      updatedAt: timestamp,
    })

    if (!saved) throw new Error('Note not found.')
    return saved
  }

  listVersions(input: ListNoteVersionsInput): NoteVersion[] {
    if (!this.versions) return []
    const note = this.repository.findById(input.noteId)
    if (!note || note.deletedAt) throw new Error('Note not found.')
    return this.versions.listForNote(input.noteId).map((version) => {
      const document = parseEditorEnvelopeJson(version.contentJson)
      const tiptapDocument = TiptapDocumentSchema.parse(document.content)
      return {
        id: version.id,
        noteId: version.noteId,
        document,
        preview: editorDocumentPlainText(tiptapDocument).slice(0, 240),
        reason: version.reason,
        createdAt: version.createdAt,
      }
    })
  }

  restoreVersion(input: RestoreNoteVersionInput): Note {
    if (!this.versions) throw new Error('Version history is unavailable.')
    const current = this.repository.findById(input.noteId)
    const selected = this.versions.findForNote(input.noteId, input.versionId)
    if (!current || current.deletedAt || current.isArchived || !selected) {
      throw new Error('Note version not found.')
    }
    const timestamp = this.now().toISOString()
    this.createCheckpoint(current.id, current.contentJson, 'restore', timestamp)
    const envelope = parseEditorEnvelopeJson(selected.contentJson)
    const document = TiptapDocumentSchema.parse(envelope.content)
    const searchText = editorDocumentPlainText(document)
    const restored = this.repository.saveContent({
      id: current.id,
      title: current.title,
      contentJson: JSON.stringify(envelope),
      preview: searchText.slice(0, 240),
      searchText,
      updatedAt: timestamp,
    })
    if (!restored) throw new Error('Note not found.')
    return restored
  }

  duplicate(input: NoteIdInput): Note {
    const source = this.repository.findById(input.id)

    if (!source || source.deletedAt) {
      throw new Error('Note not found.')
    }

    const timestamp = this.now().toISOString()
    const suffix = ' (Kopya)'
    const duplicate: Note = {
      ...source,
      id: this.createId(),
      title: `${source.title.slice(0, 200 - suffix.length)}${suffix}`,
      gridX: source.gridX + 1,
      gridY: source.gridY + 1,
      isPinned: false,
      deletedAt: null,
      lastOpenedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    this.repository.insert(duplicate)
    this.repository.copyTags(source.id, duplicate.id)
    return this.repository.findById(duplicate.id) ?? duplicate
  }

  softDelete(input: NoteIdInput): { id: string } {
    const deleted = this.repository.softDelete(input.id, this.now().toISOString())

    if (!deleted) {
      throw new Error('Note not found.')
    }

    return { id: input.id }
  }

  archive(input: NoteIdInput): Note {
    const archived = this.repository.archive(input.id, this.now().toISOString())
    if (!archived) throw new Error('Note not found.')
    return archived
  }

  unarchive(input: NoteIdInput): Note {
    const restored = this.repository.unarchive(input.id, this.now().toISOString())
    if (!restored) throw new Error('Note not found.')
    return restored
  }

  restore(input: NoteIdInput): Note {
    const restored = this.repository.restore(input.id, this.now().toISOString())
    if (!restored) throw new Error('Note not found.')
    return restored
  }

  async permanentlyDelete(input: PermanentlyDeleteNoteInput): Promise<{
    id: string
    cleanedAttachmentFiles: number
    preservedSharedAttachments: number
  }> {
    const deletion = this.repository.permanentlyDelete(input.id)
    if (!deletion) throw new Error('Note not found in trash.')
    const cleanedAttachmentFiles = await this.cleanupAttachmentFiles(deletion.orphanedRelativePaths)
    return {
      id: deletion.id,
      cleanedAttachmentFiles,
      preservedSharedAttachments: deletion.reassignedAttachmentIds.length,
    }
  }

  updateLayouts(input: UpdateNoteLayoutsInput): { updatedIds: string[] } {
    return { updatedIds: this.repository.updateLayouts(input.layouts) }
  }

  private checkpointBeforeSave(
    current: { readonly id: string; readonly contentJson: string },
    nextContentJson: string,
    timestamp: string,
  ): void {
    if (!this.versions || current.contentJson === nextContentJson) return
    const latest = this.versions.latestForNote(current.id)
    if (latest?.contentJson === current.contentJson) return
    const previousText = editorDocumentPlainText(
      TiptapDocumentSchema.parse(parseEditorEnvelopeJson(current.contentJson).content),
    )
    const nextText = editorDocumentPlainText(
      TiptapDocumentSchema.parse(parseEditorEnvelopeJson(nextContentJson).content),
    )
    const elapsed = latest
      ? Date.parse(timestamp) - Date.parse(latest.createdAt)
      : Number.POSITIVE_INFINITY
    const significantChange =
      Math.abs(nextText.length - previousText.length) >= SIGNIFICANT_TEXT_CHANGE
    if (!latest || elapsed >= CHECKPOINT_INTERVAL_MS || significantChange) {
      this.createCheckpoint(current.id, current.contentJson, 'autosave', timestamp)
    }
  }

  private createCheckpoint(
    noteId: string,
    contentJson: string,
    reason: NoteVersionReason,
    createdAt: string,
  ): void {
    this.versions?.insert({
      id: this.createVersionId(),
      noteId,
      contentJson,
      reason,
      createdAt,
    })
  }
}
