import type Database from 'better-sqlite3'

import type { NoteLayoutUpdate } from '../../shared/schemas/note-contracts'
import type { Tag } from '../../shared/schemas/tag-schema'

export interface NoteRecord {
  readonly id: string
  readonly title: string
  readonly preview: string
  readonly searchText: string
  readonly contentJson: string
  readonly color: string
  readonly gridX: number
  readonly gridY: number
  readonly gridWidth: number
  readonly gridHeight: number
  readonly isPinned: boolean
  readonly isFavorite: boolean
  readonly isArchived: boolean
  readonly deletedAt: string | null
  readonly lastOpenedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly tags?: Tag[]
}

export interface PermanentNoteDeletion {
  readonly id: string
  readonly orphanedRelativePaths: string[]
  readonly reassignedAttachmentIds: string[]
}

interface NoteRow extends Omit<NoteRecord, 'isPinned' | 'isFavorite' | 'isArchived'> {
  readonly isPinned: 0 | 1
  readonly isFavorite: 0 | 1
  readonly isArchived: 0 | 1
}

function mapNoteRow(row: NoteRow): NoteRecord {
  return {
    ...row,
    isPinned: row.isPinned === 1,
    isFavorite: row.isFavorite === 1,
    isArchived: row.isArchived === 1,
  }
}

function contentReferencesAttachment(contentJson: string, attachmentId: string): boolean {
  let document: unknown
  try {
    document = JSON.parse(contentJson)
  } catch {
    return false
  }

  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit)
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    if (record['attachmentId'] === attachmentId) return true
    return Object.values(record).some(visit)
  }
  return visit(document)
}

export class NoteRepository {
  constructor(private readonly database: Database.Database) {}

  insert(note: NoteRecord): void {
    this.database
      .prepare(
        `INSERT INTO Notes (
          id, title, preview, searchText, contentJson, color,
          gridX, gridY, gridWidth, gridHeight,
          isPinned, isFavorite, isArchived,
          deletedAt, lastOpenedAt, createdAt, updatedAt
        ) VALUES (
          @id, @title, @preview, @searchText, @contentJson, @color,
          @gridX, @gridY, @gridWidth, @gridHeight,
          @isPinned, @isFavorite, @isArchived,
          @deletedAt, @lastOpenedAt, @createdAt, @updatedAt
        )`,
      )
      .run({
        ...note,
        isPinned: Number(note.isPinned),
        isFavorite: Number(note.isFavorite),
        isArchived: Number(note.isArchived),
      })
  }

  findById(id: string): NoteRecord | null {
    const row = this.database.prepare('SELECT * FROM Notes WHERE id = ?').get(id) as
      NoteRow | undefined

    return row ? (this.hydrateTags([mapNoteRow(row)])[0] ?? null) : null
  }

  listActive(): NoteRecord[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM Notes
         WHERE deletedAt IS NULL AND isArchived = 0
         ORDER BY isPinned DESC, updatedAt DESC, id ASC`,
      )
      .all() as NoteRow[]

    return this.hydrateTags(rows.map(mapNoteRow))
  }

  listArchived(): NoteRecord[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM Notes
         WHERE deletedAt IS NULL AND isArchived = 1
         ORDER BY updatedAt DESC, id ASC`,
      )
      .all() as NoteRow[]
    return this.hydrateTags(rows.map(mapNoteRow))
  }

  listTrashed(): NoteRecord[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM Notes
         WHERE deletedAt IS NOT NULL
         ORDER BY deletedAt DESC, id ASC`,
      )
      .all() as NoteRow[]
    return this.hydrateTags(rows.map(mapNoteRow))
  }

  searchActive(query: string, limit = 500): NoteRecord[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM Notes
         WHERE deletedAt IS NULL AND isArchived = 0
           AND (
             instr(
               wovennote_search_fold(title || char(10) || searchText),
               wovennote_search_fold(?)
             ) > 0
             OR EXISTS (
               SELECT 1 FROM NoteTags AS relation
               INNER JOIN Tags AS tag ON tag.id = relation.tagId
               WHERE relation.noteId = Notes.id
                 AND instr(wovennote_search_fold(tag.name), wovennote_search_fold(?)) > 0
             )
           )
         ORDER BY isPinned DESC, updatedAt DESC, id ASC
         LIMIT ?`,
      )
      .all(query, query, limit) as NoteRow[]
    return this.hydrateTags(rows.map(mapNoteRow))
  }

  setPinned(id: string, value: boolean, updatedAt: string): NoteRecord | null {
    return this.setBooleanFlag('isPinned', id, value, updatedAt)
  }

  setFavorite(id: string, value: boolean, updatedAt: string): NoteRecord | null {
    return this.setBooleanFlag('isFavorite', id, value, updatedAt)
  }

  archive(id: string, updatedAt: string): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes SET isArchived = 1, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL AND isArchived = 0`,
      )
      .run(updatedAt, id)
    return result.changes === 1 ? this.findById(id) : null
  }

  unarchive(id: string, updatedAt: string): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes SET isArchived = 0, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL AND isArchived = 1`,
      )
      .run(updatedAt, id)
    return result.changes === 1 ? this.findById(id) : null
  }

  restore(id: string, updatedAt: string): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes SET deletedAt = NULL, isArchived = 0, updatedAt = ?
         WHERE id = ? AND deletedAt IS NOT NULL`,
      )
      .run(updatedAt, id)
    return result.changes === 1 ? this.findById(id) : null
  }

  copyTags(sourceNoteId: string, targetNoteId: string): void {
    this.database
      .prepare(
        `INSERT INTO NoteTags (noteId, tagId)
         SELECT ?, tagId FROM NoteTags WHERE noteId = ?`,
      )
      .run(targetNoteId, sourceNoteId)
  }

  updateTitle(id: string, title: string, updatedAt: string): NoteRecord | null {
    const result = this.database
      .prepare('UPDATE Notes SET title = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL')
      .run(title, updatedAt, id)

    return result.changes === 1 ? this.findById(id) : null
  }

  markOpened(id: string, lastOpenedAt: string): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes SET lastOpenedAt = ?
         WHERE id = ? AND deletedAt IS NULL AND isArchived = 0`,
      )
      .run(lastOpenedAt, id)

    return result.changes === 1 ? this.findById(id) : null
  }

  saveContent(input: {
    readonly id: string
    readonly title: string
    readonly contentJson: string
    readonly preview: string
    readonly searchText: string
    readonly updatedAt: string
  }): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes
         SET title = @title,
             contentJson = @contentJson,
             preview = @preview,
             searchText = @searchText,
             updatedAt = @updatedAt
         WHERE id = @id AND deletedAt IS NULL AND isArchived = 0`,
      )
      .run(input)

    return result.changes === 1 ? this.findById(input.id) : null
  }

  softDelete(id: string, deletedAt: string): boolean {
    const result = this.database
      .prepare(
        `UPDATE Notes SET deletedAt = ?, isArchived = 0, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL`,
      )
      .run(deletedAt, deletedAt, id)

    return result.changes === 1
  }

  permanentlyDelete(id: string): PermanentNoteDeletion | null {
    const remove = this.database.transaction((): PermanentNoteDeletion | null => {
      const target = this.database
        .prepare('SELECT id FROM Notes WHERE id = ? AND deletedAt IS NOT NULL LIMIT 1')
        .get(id)
      if (!target) return null

      const attachments = this.database
        .prepare('SELECT id, relativePath FROM Attachments WHERE noteId = ? ORDER BY id ASC')
        .all(id) as Array<{ id: string; relativePath: string }>
      const survivingNotes = this.database
        .prepare('SELECT id, contentJson FROM Notes WHERE id <> ?')
        .all(id) as Array<{ id: string; contentJson: string }>
      const orphanedRelativePaths: string[] = []
      const reassignedAttachmentIds: string[] = []

      for (const attachment of attachments) {
        const owner = survivingNotes.find((note) =>
          contentReferencesAttachment(note.contentJson, attachment.id),
        )
        if (owner) {
          this.database
            .prepare('UPDATE Attachments SET noteId = ? WHERE id = ? AND noteId = ?')
            .run(owner.id, attachment.id, id)
          reassignedAttachmentIds.push(attachment.id)
        } else {
          orphanedRelativePaths.push(attachment.relativePath)
        }
      }

      const deleted = this.database
        .prepare('DELETE FROM Notes WHERE id = ? AND deletedAt IS NOT NULL')
        .run(id)
      if (deleted.changes !== 1) throw new Error('Note could not be permanently deleted.')

      return { id, orphanedRelativePaths, reassignedAttachmentIds }
    })
    return remove()
  }

  updateLayouts(layouts: readonly NoteLayoutUpdate[]): string[] {
    const update = this.database.prepare(
      `UPDATE Notes
       SET gridX = @gridX, gridY = @gridY, gridWidth = @gridWidth, gridHeight = @gridHeight
       WHERE id = @id AND deletedAt IS NULL`,
    )
    const updateTransaction = this.database.transaction(
      (layoutUpdates: readonly NoteLayoutUpdate[]): string[] => {
        for (const layout of layoutUpdates) {
          if (update.run(layout).changes !== 1) {
            throw new Error('Note not found.')
          }
        }

        return layoutUpdates.map((layout) => layout.id)
      },
    )

    return updateTransaction(layouts)
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM Notes').get() as {
      count: number
    }

    return row.count
  }

  private setBooleanFlag(
    column: 'isPinned' | 'isFavorite',
    id: string,
    value: boolean,
    updatedAt: string,
  ): NoteRecord | null {
    const result = this.database
      .prepare(
        `UPDATE Notes SET ${column} = ?, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL AND isArchived = 0`,
      )
      .run(Number(value), updatedAt, id)
    return result.changes === 1 ? this.findById(id) : null
  }

  private hydrateTags(notes: readonly NoteRecord[]): NoteRecord[] {
    if (notes.length === 0) return []
    const placeholders = notes.map(() => '?').join(', ')
    const rows = this.database
      .prepare(
        `SELECT relation.noteId, tag.id, tag.name, tag.color, tag.createdAt
         FROM NoteTags AS relation
         INNER JOIN Tags AS tag ON tag.id = relation.tagId
         WHERE relation.noteId IN (${placeholders})
         ORDER BY wovennote_search_fold(tag.name), tag.id`,
      )
      .all(...notes.map((note) => note.id)) as Array<Tag & { noteId: string }>
    const tagsByNote = new Map<string, Tag[]>()
    for (const row of rows) {
      const tags = tagsByNote.get(row.noteId) ?? []
      tags.push({ id: row.id, name: row.name, color: row.color, createdAt: row.createdAt })
      tagsByNote.set(row.noteId, tags)
    }
    return notes.map((note) => ({ ...note, tags: tagsByNote.get(note.id) ?? [] }))
  }
}
