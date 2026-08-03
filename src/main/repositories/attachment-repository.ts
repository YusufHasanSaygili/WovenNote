import type Database from 'better-sqlite3'

export interface AttachmentRecord {
  readonly id: string
  readonly noteId: string
  readonly blockId: string | null
  readonly originalFileName: string
  readonly storedFileName: string
  readonly relativePath: string
  readonly mimeType: string
  readonly fileSize: number
  readonly width: number | null
  readonly height: number | null
  readonly createdAt: string
}

export class AttachmentRepository {
  constructor(private readonly database: Database.Database) {}

  insert(attachment: AttachmentRecord): void {
    this.database
      .prepare(
        `INSERT INTO Attachments (
          id, noteId, blockId, originalFileName, storedFileName,
          relativePath, mimeType, fileSize, width, height, createdAt
        ) VALUES (
          @id, @noteId, @blockId, @originalFileName, @storedFileName,
          @relativePath, @mimeType, @fileSize, @width, @height, @createdAt
        )`,
      )
      .run(attachment)
  }

  findById(id: string): AttachmentRecord | null {
    const row = this.database.prepare('SELECT * FROM Attachments WHERE id = ?').get(id) as
      AttachmentRecord | undefined

    return row ?? null
  }

  listForNote(noteId: string): AttachmentRecord[] {
    return this.database
      .prepare('SELECT * FROM Attachments WHERE noteId = ? ORDER BY createdAt ASC, id ASC')
      .all(noteId) as AttachmentRecord[]
  }

  count(): number {
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM Attachments').get() as {
      count: number
    }

    return row.count
  }
}
