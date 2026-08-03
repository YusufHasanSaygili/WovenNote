import type Database from 'better-sqlite3'

import type { Tag } from '../../shared/schemas/tag-schema'

export class TagRepository {
  constructor(private readonly database: Database.Database) {}

  insert(tag: Tag): void {
    this.database
      .prepare(
        'INSERT INTO Tags (id, name, color, createdAt) VALUES (@id, @name, @color, @createdAt)',
      )
      .run(tag)
  }

  list(): Tag[] {
    return this.database
      .prepare(
        'SELECT id, name, color, createdAt FROM Tags ORDER BY wovennote_search_fold(name), id',
      )
      .all() as Tag[]
  }

  findByName(name: string): Tag | null {
    return (
      (this.database
        .prepare(
          `SELECT id, name, color, createdAt FROM Tags
           WHERE wovennote_search_fold(name) = wovennote_search_fold(?) LIMIT 1`,
        )
        .get(name) as Tag | undefined) ?? null
    )
  }

  listForNote(noteId: string): Tag[] {
    return this.database
      .prepare(
        `SELECT tag.id, tag.name, tag.color, tag.createdAt
         FROM NoteTags AS relation
         INNER JOIN Tags AS tag ON tag.id = relation.tagId
         WHERE relation.noteId = ?
         ORDER BY wovennote_search_fold(tag.name), tag.id`,
      )
      .all(noteId) as Tag[]
  }

  setForNote(noteId: string, tagIds: readonly string[]): void {
    const transaction = this.database.transaction(() => {
      const note = this.database
        .prepare(
          'SELECT id FROM Notes WHERE id = ? AND deletedAt IS NULL AND isArchived = 0 LIMIT 1',
        )
        .get(noteId)
      if (!note) throw new Error('Note not found.')

      if (tagIds.length > 0) {
        const placeholders = tagIds.map(() => '?').join(', ')
        const row = this.database
          .prepare(`SELECT COUNT(*) AS count FROM Tags WHERE id IN (${placeholders})`)
          .get(...tagIds) as { count: number }
        if (row.count !== tagIds.length) throw new Error('Tag not found.')
      }

      this.database.prepare('DELETE FROM NoteTags WHERE noteId = ?').run(noteId)
      const insert = this.database.prepare('INSERT INTO NoteTags (noteId, tagId) VALUES (?, ?)')
      for (const tagId of tagIds) insert.run(noteId, tagId)
    })
    transaction()
  }
}
