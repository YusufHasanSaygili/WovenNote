import type Database from 'better-sqlite3'

export type NoteVersionReason = 'autosave' | 'restore'

export interface NoteVersionRecord {
  readonly id: string
  readonly noteId: string
  readonly contentJson: string
  readonly reason: NoteVersionReason
  readonly createdAt: string
}

export class NoteVersionRepository {
  constructor(private readonly database: Database.Database) {}

  insert(version: NoteVersionRecord): void {
    this.database
      .prepare(
        `INSERT INTO NoteVersions (id, noteId, contentJson, reason, createdAt)
         VALUES (@id, @noteId, @contentJson, @reason, @createdAt)`,
      )
      .run(version)
  }

  listForNote(noteId: string): NoteVersionRecord[] {
    return this.database
      .prepare(
        `SELECT id, noteId, contentJson, reason, createdAt
         FROM NoteVersions WHERE noteId = ?
         ORDER BY createdAt DESC, id DESC`,
      )
      .all(noteId) as NoteVersionRecord[]
  }

  findForNote(noteId: string, versionId: string): NoteVersionRecord | null {
    return (
      (this.database
        .prepare(
          `SELECT id, noteId, contentJson, reason, createdAt
           FROM NoteVersions WHERE noteId = ? AND id = ? LIMIT 1`,
        )
        .get(noteId, versionId) as NoteVersionRecord | undefined) ?? null
    )
  }

  latestForNote(noteId: string): NoteVersionRecord | null {
    return (
      (this.database
        .prepare(
          `SELECT id, noteId, contentJson, reason, createdAt
           FROM NoteVersions WHERE noteId = ?
           ORDER BY createdAt DESC, id DESC LIMIT 1`,
        )
        .get(noteId) as NoteVersionRecord | undefined) ?? null
    )
  }

  countForNote(noteId: string): number {
    const row = this.database
      .prepare('SELECT COUNT(*) AS count FROM NoteVersions WHERE noteId = ?')
      .get(noteId) as { count: number }
    return row.count
  }
}
