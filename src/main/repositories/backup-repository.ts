import { extname } from 'node:path'

import type Database from 'better-sqlite3'

import type {
  BackupAttachment,
  BackupConflictStrategy,
  BackupData,
  BackupManifest,
  BackupNote,
} from '../../shared/schemas/backup-contracts'
import { normalizeTurkishSearchText } from '../database/search-normalization'

export type StoredAttachmentMetadata = Omit<BackupAttachment, 'archivePath' | 'sha256'>

export interface BackupDatabaseSnapshot extends Omit<BackupData, 'attachments'> {
  readonly attachments: readonly StoredAttachmentMetadata[]
}

interface PreparedAttachment {
  readonly record: StoredAttachmentMetadata
  readonly sourceArchivePath: string
}

export interface PreparedBackupImport {
  readonly notes: readonly BackupNote[]
  readonly tags: BackupData['tags']
  readonly noteTags: BackupData['noteTags']
  readonly attachments: readonly PreparedAttachment[]
  readonly chatSessions: BackupData['chatSessions']
  readonly chatMessages: BackupData['chatMessages']
  readonly noteVersions: BackupData['noteVersions']
  readonly settings: BackupData['settings']
  readonly replacedNoteIds: readonly string[]
  readonly obsoleteAttachmentPaths: readonly string[]
  readonly notesSkipped: number
  readonly strategy: BackupConflictStrategy
}

interface RawNote extends Omit<BackupNote, 'isPinned' | 'isFavorite' | 'isArchived'> {
  readonly isPinned: number
  readonly isFavorite: number
  readonly isArchived: number
}

function remapContentJson(contentJson: string, attachmentIds: ReadonlyMap<string, string>): string {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') return value
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(source)) {
      result[key] =
        key === 'attachmentId' && typeof child === 'string'
          ? (attachmentIds.get(child) ?? child)
          : visit(child)
    }
    return result
  }
  return JSON.stringify(visit(JSON.parse(contentJson)))
}

function attachmentReferences(contentJson: string): Set<string> {
  const references = new Set<string>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'attachmentId' && typeof child === 'string') references.add(child)
      else visit(child)
    }
  }
  visit(JSON.parse(contentJson))
  return references
}

function nextUniqueId(createId: () => string, usedIds: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = createId()
    if (/^[a-zA-Z0-9-]{1,100}$/.test(id) && !usedIds.has(id)) {
      usedIds.add(id)
      return id
    }
  }
  throw new Error('Yedek geri yükleme için benzersiz kimlik üretilemedi.')
}

export class BackupRepository {
  constructor(private readonly database: Database.Database) {}

  exportSnapshot(): BackupDatabaseSnapshot {
    const rawNotes = this.database.prepare('SELECT * FROM Notes ORDER BY id').all() as RawNote[]
    const notes = rawNotes.map((note) => ({
      ...note,
      isPinned: Boolean(note.isPinned),
      isFavorite: Boolean(note.isFavorite),
      isArchived: Boolean(note.isArchived),
    }))
    const settings = this.database
      .prepare(
        `SELECT key, valueJson, updatedAt FROM Settings
         WHERE key IN ('ai-preferences-v1', 'note-detail-layout')
         ORDER BY key`,
      )
      .all() as BackupData['settings']

    return {
      notes,
      tags: this.database.prepare('SELECT * FROM Tags ORDER BY id').all() as BackupData['tags'],
      noteTags: this.database
        .prepare('SELECT noteId, tagId FROM NoteTags ORDER BY noteId, tagId')
        .all() as BackupData['noteTags'],
      attachments: this.database
        .prepare('SELECT * FROM Attachments ORDER BY id')
        .all() as StoredAttachmentMetadata[],
      chatSessions: this.database
        .prepare('SELECT * FROM ChatSessions ORDER BY id')
        .all() as BackupData['chatSessions'],
      chatMessages: this.database
        .prepare('SELECT * FROM ChatMessages ORDER BY id')
        .all() as BackupData['chatMessages'],
      noteVersions: this.database
        .prepare('SELECT * FROM NoteVersions ORDER BY id')
        .all() as BackupData['noteVersions'],
      settings,
    }
  }

  countNoteConflicts(manifest: BackupManifest): number {
    const existing = new Set(
      (this.database.prepare('SELECT id FROM Notes').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    return manifest.data.notes.filter((note) => existing.has(note.id)).length
  }

  prepareImport(
    manifest: BackupManifest,
    strategy: BackupConflictStrategy,
    createId: () => string,
  ): PreparedBackupImport {
    const existingNoteIds = new Set(
      (this.database.prepare('SELECT id FROM Notes').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    const usedNoteIds = new Set(existingNoteIds)
    const noteIds = new Map<string, string>()
    const replacedNoteIds: string[] = []
    let notesSkipped = 0
    for (const note of manifest.data.notes) {
      const conflict = existingNoteIds.has(note.id)
      if (conflict && strategy === 'keep-existing') {
        notesSkipped += 1
        continue
      }
      if (conflict && strategy === 'replace') replacedNoteIds.push(note.id)
      if (conflict && strategy === 'keep-both') {
        noteIds.set(note.id, nextUniqueId(createId, usedNoteIds))
      } else {
        noteIds.set(note.id, note.id)
        usedNoteIds.add(note.id)
      }
    }

    const existingTags = this.database
      .prepare('SELECT * FROM Tags ORDER BY id')
      .all() as BackupData['tags']
    const usedTagIds = new Set(existingTags.map((tag) => tag.id))
    const tagsByName = new Map(
      existingTags.map((tag) => [normalizeTurkishSearchText(tag.name), tag.id] as const),
    )
    const tagIds = new Map<string, string>()
    const tags: BackupData['tags'] = []
    for (const tag of manifest.data.tags) {
      const normalizedName = normalizeTurkishSearchText(tag.name)
      const matchingId = tagsByName.get(normalizedName)
      if (matchingId) {
        tagIds.set(tag.id, matchingId)
        continue
      }
      const id = usedTagIds.has(tag.id) ? nextUniqueId(createId, usedTagIds) : tag.id
      usedTagIds.add(id)
      tagsByName.set(normalizedName, id)
      tagIds.set(tag.id, id)
      tags.push({ ...tag, id })
    }

    const includedAttachmentOwner = new Map<string, string>()
    for (const note of manifest.data.notes) {
      const mappedNoteId = noteIds.get(note.id)
      if (!mappedNoteId) continue
      for (const attachmentId of attachmentReferences(note.contentJson)) {
        if (!includedAttachmentOwner.has(attachmentId)) {
          includedAttachmentOwner.set(attachmentId, mappedNoteId)
        }
      }
    }
    const usedAttachmentIds = new Set(
      (this.database.prepare('SELECT id FROM Attachments').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    const attachmentIds = new Map<string, string>()
    const attachments: PreparedAttachment[] = []
    for (const attachment of manifest.data.attachments) {
      const noteId = noteIds.get(attachment.noteId) ?? includedAttachmentOwner.get(attachment.id)
      if (!noteId) continue
      const id = nextUniqueId(createId, usedAttachmentIds)
      const extension = extname(attachment.storedFileName).toLocaleLowerCase('en-US')
      const storedFileName = `${id}${extension}`
      attachmentIds.set(attachment.id, id)
      attachments.push({
        sourceArchivePath: attachment.archivePath,
        record: {
          id,
          noteId,
          blockId: attachment.blockId,
          originalFileName: attachment.originalFileName,
          storedFileName,
          relativePath: storedFileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          width: attachment.width,
          height: attachment.height,
          createdAt: attachment.createdAt,
        },
      })
    }

    const notes = manifest.data.notes.flatMap((note) => {
      const id = noteIds.get(note.id)
      return id
        ? [{ ...note, id, contentJson: remapContentJson(note.contentJson, attachmentIds) }]
        : []
    })
    const noteTags = manifest.data.noteTags.flatMap((relation) => {
      const noteId = noteIds.get(relation.noteId)
      const tagId = tagIds.get(relation.tagId)
      return noteId && tagId ? [{ noteId, tagId }] : []
    })

    const usedSessionIds = new Set(
      (this.database.prepare('SELECT id FROM ChatSessions').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    const sessionIds = new Map<string, string>()
    const chatSessions = manifest.data.chatSessions.flatMap((session) => {
      const noteId = noteIds.get(session.noteId)
      if (!noteId) return []
      const id = nextUniqueId(createId, usedSessionIds)
      sessionIds.set(session.id, id)
      return [{ ...session, id, noteId }]
    })
    const usedMessageIds = new Set(
      (this.database.prepare('SELECT id FROM ChatMessages').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    const chatMessages = manifest.data.chatMessages.flatMap((message) => {
      const sessionId = sessionIds.get(message.sessionId)
      return sessionId
        ? [{ ...message, id: nextUniqueId(createId, usedMessageIds), sessionId }]
        : []
    })
    const usedVersionIds = new Set(
      (this.database.prepare('SELECT id FROM NoteVersions').all() as Array<{ id: string }>).map(
        (row) => row.id,
      ),
    )
    const noteVersions = manifest.data.noteVersions.flatMap((version) => {
      const noteId = noteIds.get(version.noteId)
      return noteId
        ? [
            {
              ...version,
              id: nextUniqueId(createId, usedVersionIds),
              noteId,
              contentJson: remapContentJson(version.contentJson, attachmentIds),
            },
          ]
        : []
    })
    const obsoleteAttachmentPaths =
      replacedNoteIds.length === 0
        ? []
        : (
            this.database
              .prepare(
                `SELECT relativePath FROM Attachments
                 WHERE noteId IN (${replacedNoteIds.map(() => '?').join(', ')})`,
              )
              .all(...replacedNoteIds) as Array<{ relativePath: string }>
          ).map((row) => row.relativePath)

    return {
      notes,
      tags,
      noteTags,
      attachments,
      chatSessions,
      chatMessages,
      noteVersions,
      settings: manifest.data.settings,
      replacedNoteIds,
      obsoleteAttachmentPaths,
      notesSkipped,
      strategy,
    }
  }

  applyPreparedImport(prepared: PreparedBackupImport): void {
    const deleteNote = this.database.prepare('DELETE FROM Notes WHERE id = ?')
    prepared.replacedNoteIds.forEach((id) => deleteNote.run(id))

    const insertTag = this.database.prepare(
      'INSERT INTO Tags (id, name, color, createdAt) VALUES (@id, @name, @color, @createdAt)',
    )
    prepared.tags.forEach((row) => insertTag.run(row))

    const insertNote = this.database.prepare(`
      INSERT INTO Notes (
        id, title, preview, searchText, contentJson, color, gridX, gridY, gridWidth, gridHeight,
        isPinned, isFavorite, isArchived, deletedAt, lastOpenedAt, createdAt, updatedAt
      ) VALUES (
        @id, @title, @preview, @searchText, @contentJson, @color, @gridX, @gridY, @gridWidth, @gridHeight,
        @isPinned, @isFavorite, @isArchived, @deletedAt, @lastOpenedAt, @createdAt, @updatedAt
      )
    `)
    prepared.notes.forEach((row) =>
      insertNote.run({
        ...row,
        isPinned: Number(row.isPinned),
        isFavorite: Number(row.isFavorite),
        isArchived: Number(row.isArchived),
      }),
    )

    const insertAttachment = this.database.prepare(`
      INSERT INTO Attachments (
        id, noteId, blockId, originalFileName, storedFileName, relativePath,
        mimeType, fileSize, width, height, createdAt
      ) VALUES (
        @id, @noteId, @blockId, @originalFileName, @storedFileName, @relativePath,
        @mimeType, @fileSize, @width, @height, @createdAt
      )
    `)
    prepared.attachments.forEach((item) => insertAttachment.run(item.record))

    const insertSession = this.database.prepare(`
      INSERT INTO ChatSessions (id, noteId, title, createdAt, updatedAt)
      VALUES (@id, @noteId, @title, @createdAt, @updatedAt)
    `)
    prepared.chatSessions.forEach((row) => insertSession.run(row))
    const insertMessage = this.database.prepare(`
      INSERT INTO ChatMessages (id, sessionId, role, content, status, createdAt)
      VALUES (@id, @sessionId, @role, @content, @status, @createdAt)
    `)
    prepared.chatMessages.forEach((row) => insertMessage.run(row))
    const insertVersion = this.database.prepare(`
      INSERT INTO NoteVersions (id, noteId, contentJson, reason, createdAt)
      VALUES (@id, @noteId, @contentJson, @reason, @createdAt)
    `)
    prepared.noteVersions.forEach((row) => insertVersion.run(row))
    const insertNoteTag = this.database.prepare(
      'INSERT INTO NoteTags (noteId, tagId) VALUES (@noteId, @tagId)',
    )
    prepared.noteTags.forEach((row) => insertNoteTag.run(row))

    const keepSetting = this.database.prepare(
      'INSERT OR IGNORE INTO Settings (key, valueJson, updatedAt) VALUES (@key, @valueJson, @updatedAt)',
    )
    const replaceSetting = this.database.prepare(`
      INSERT INTO Settings (key, valueJson, updatedAt) VALUES (@key, @valueJson, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson, updatedAt = excluded.updatedAt
    `)
    prepared.settings.forEach((row) =>
      (prepared.strategy === 'replace' ? replaceSetting : keepSetting).run(row),
    )
  }
}
