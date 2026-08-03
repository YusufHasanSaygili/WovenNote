// @vitest-environment node

import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { DatabaseMigrationError, runMigrations, type Migration } from './migrations'

let database: Database.Database | undefined

afterEach(() => {
  if (database?.open) {
    database.close()
  }
  database = undefined
})

describe('database migrations', () => {
  it('creates the complete Notes foundation on an empty database', () => {
    database = new Database(':memory:')

    runMigrations(database)

    const columns = database.prepare('PRAGMA table_info(Notes)').all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'title',
      'preview',
      'searchText',
      'contentJson',
      'color',
      'gridX',
      'gridY',
      'gridWidth',
      'gridHeight',
      'isPinned',
      'isFavorite',
      'isArchived',
      'deletedAt',
      'lastOpenedAt',
      'createdAt',
      'updatedAt',
    ])
    const settingsColumns = database.prepare('PRAGMA table_info(Settings)').all() as Array<{
      name: string
    }>
    expect(settingsColumns.map((column) => column.name)).toEqual(['key', 'valueJson', 'updatedAt'])
    const attachmentColumns = database.prepare('PRAGMA table_info(Attachments)').all() as Array<{
      name: string
    }>
    expect(attachmentColumns.map((column) => column.name)).toEqual([
      'id',
      'noteId',
      'blockId',
      'originalFileName',
      'storedFileName',
      'relativePath',
      'mimeType',
      'fileSize',
      'width',
      'height',
      'createdAt',
    ])
    const chatSessionColumns = database.prepare('PRAGMA table_info(ChatSessions)').all() as Array<{
      name: string
    }>
    const chatMessageColumns = database.prepare('PRAGMA table_info(ChatMessages)').all() as Array<{
      name: string
    }>
    expect(chatSessionColumns.map((column) => column.name)).toEqual([
      'id',
      'noteId',
      'title',
      'createdAt',
      'updatedAt',
    ])
    expect(chatMessageColumns.map((column) => column.name)).toEqual([
      'id',
      'sessionId',
      'role',
      'content',
      'status',
      'createdAt',
    ])
    const tagColumns = database.prepare('PRAGMA table_info(Tags)').all() as Array<{
      name: string
    }>
    const noteTagColumns = database.prepare('PRAGMA table_info(NoteTags)').all() as Array<{
      name: string
    }>
    expect(tagColumns.map((column) => column.name)).toEqual(['id', 'name', 'color', 'createdAt'])
    expect(noteTagColumns.map((column) => column.name)).toEqual(['noteId', 'tagId'])
    const versionColumns = database.prepare('PRAGMA table_info(NoteVersions)').all() as Array<{
      name: string
    }>
    expect(versionColumns.map((column) => column.name)).toEqual([
      'id',
      'noteId',
      'contentJson',
      'reason',
      'createdAt',
    ])
    expect(database.pragma('user_version', { simple: true })).toBe(7)
  })

  it('is idempotent when run more than once', () => {
    database = new Database(':memory:')

    runMigrations(database)
    runMigrations(database)

    const applied = database.prepare('SELECT version, name FROM SchemaMigrations').all() as Array<{
      version: number
      name: string
    }>
    expect(applied).toEqual([
      { version: 1, name: 'notes-foundation' },
      { version: 2, name: 'settings-foundation' },
      { version: 3, name: 'attachments-foundation' },
      { version: 4, name: 'ai-chat-foundation' },
      { version: 5, name: 'tags-and-note-tags' },
      { version: 6, name: 'note-versions-foundation' },
      { version: 7, name: 'wovennote-search-function' },
    ])
  })

  it('rolls a failed migration back without recording it', () => {
    database = new Database(':memory:')
    const failingMigrations: readonly Migration[] = [
      {
        version: 1,
        name: 'failing-migration',
        up: (connection) => {
          connection.exec('CREATE TABLE TemporaryValue (id TEXT PRIMARY KEY) STRICT;')
          throw new Error('expected failure')
        },
      },
    ]

    expect(() => runMigrations(database!, failingMigrations)).toThrow(DatabaseMigrationError)
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE name = 'TemporaryValue'").get(),
    ).toBeUndefined()
    expect(database.prepare('SELECT version FROM SchemaMigrations').all()).toEqual([])
  })
})
