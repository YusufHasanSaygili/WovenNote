import type Database from 'better-sqlite3'

import { normalizeTurkishSearchText } from './search-normalization'

export interface Migration {
  readonly version: number
  readonly name: string
  readonly up: (database: Database.Database) => void
}

export class DatabaseMigrationError extends Error {
  readonly version: number

  constructor(version: number, cause?: unknown) {
    super(`Veritabanı migration ${version} uygulanamadı.`, { cause })
    this.name = 'DatabaseMigrationError'
    this.version = version
  }
}

const notesFoundationMigration: Migration = {
  version: 1,
  name: 'notes-foundation',
  up: (database) => {
    database.exec(`
      CREATE TABLE Notes (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        preview TEXT NOT NULL DEFAULT '',
        searchText TEXT NOT NULL DEFAULT '',
        contentJson TEXT NOT NULL DEFAULT '{"documentVersion":1,"editor":"tiptap","content":{}}',
        color TEXT NOT NULL DEFAULT '#fff4bd',
        gridX INTEGER NOT NULL DEFAULT 0 CHECK (gridX >= 0),
        gridY INTEGER NOT NULL DEFAULT 0 CHECK (gridY >= 0),
        gridWidth INTEGER NOT NULL DEFAULT 3 CHECK (gridWidth > 0),
        gridHeight INTEGER NOT NULL DEFAULT 4 CHECK (gridHeight > 0),
        isPinned INTEGER NOT NULL DEFAULT 0 CHECK (isPinned IN (0, 1)),
        isFavorite INTEGER NOT NULL DEFAULT 0 CHECK (isFavorite IN (0, 1)),
        isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0, 1)),
        deletedAt TEXT,
        lastOpenedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_notes_active_updated
        ON Notes (deletedAt, isArchived, updatedAt DESC);
    `)
  },
}

const settingsFoundationMigration: Migration = {
  version: 2,
  name: 'settings-foundation',
  up: (database) => {
    database.exec(`
      CREATE TABLE Settings (
        key TEXT PRIMARY KEY NOT NULL,
        valueJson TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      ) STRICT;
    `)
  },
}

const attachmentsFoundationMigration: Migration = {
  version: 3,
  name: 'attachments-foundation',
  up: (database) => {
    database.exec(`
      CREATE TABLE Attachments (
        id TEXT PRIMARY KEY NOT NULL,
        noteId TEXT NOT NULL REFERENCES Notes(id) ON DELETE CASCADE,
        blockId TEXT,
        originalFileName TEXT NOT NULL,
        storedFileName TEXT NOT NULL UNIQUE,
        relativePath TEXT NOT NULL UNIQUE,
        mimeType TEXT NOT NULL,
        fileSize INTEGER NOT NULL CHECK (fileSize >= 0),
        width INTEGER CHECK (width IS NULL OR width > 0),
        height INTEGER CHECK (height IS NULL OR height > 0),
        createdAt TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_attachments_note_created
        ON Attachments (noteId, createdAt ASC);
    `)
  },
}

const aiChatFoundationMigration: Migration = {
  version: 4,
  name: 'ai-chat-foundation',
  up: (database) => {
    database.exec(`
      CREATE TABLE ChatSessions (
        id TEXT PRIMARY KEY NOT NULL,
        noteId TEXT NOT NULL REFERENCES Notes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_chat_sessions_note_updated
        ON ChatSessions (noteId, updatedAt DESC);

      CREATE TABLE ChatMessages (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT NOT NULL REFERENCES ChatSessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'error', 'cancelled')),
        createdAt TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_chat_messages_session_created
        ON ChatMessages (sessionId, createdAt ASC, id ASC);
    `)
  },
}

const organizationFoundationMigration: Migration = {
  version: 5,
  name: 'tags-and-note-tags',
  up: (database) => {
    database.function('wovennote_search_fold', { deterministic: true }, normalizeTurkishSearchText)
    database.exec(`
      CREATE TABLE Tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
        color TEXT NOT NULL,
        createdAt TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX idx_tags_normalized_name
        ON Tags (wovennote_search_fold(name));

      CREATE TABLE NoteTags (
        noteId TEXT NOT NULL REFERENCES Notes(id) ON DELETE CASCADE,
        tagId TEXT NOT NULL REFERENCES Tags(id) ON DELETE CASCADE,
        PRIMARY KEY (noteId, tagId)
      ) STRICT;

      CREATE INDEX idx_note_tags_tag_note ON NoteTags (tagId, noteId);
    `)
  },
}

const noteVersionsFoundationMigration: Migration = {
  version: 6,
  name: 'note-versions-foundation',
  up: (database) => {
    database.exec(`
      CREATE TABLE NoteVersions (
        id TEXT PRIMARY KEY NOT NULL,
        noteId TEXT NOT NULL REFERENCES Notes(id) ON DELETE CASCADE,
        contentJson TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('autosave', 'restore')),
        createdAt TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_note_versions_note_created
        ON NoteVersions (noteId, createdAt DESC, id DESC);
    `)
  },
}

const wovenNoteSearchFunctionMigration: Migration = {
  version: 7,
  name: 'wovennote-search-function',
  up: (database) => {
    database.function('wovennote_search_fold', { deterministic: true }, normalizeTurkishSearchText)
    database.exec(`
      DROP INDEX IF EXISTS idx_tags_normalized_name;
      CREATE UNIQUE INDEX idx_tags_normalized_name
        ON Tags (wovennote_search_fold(name));
    `)
  },
}

export const MIGRATIONS: readonly Migration[] = Object.freeze([
  notesFoundationMigration,
  settingsFoundationMigration,
  attachmentsFoundationMigration,
  aiChatFoundationMigration,
  organizationFoundationMigration,
  noteVersionsFoundationMigration,
  wovenNoteSearchFunctionMigration,
])

function validateMigrationSequence(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1

    if (migration.version !== expectedVersion) {
      throw new DatabaseMigrationError(
        migration.version,
        new Error(`Beklenen migration sürümü ${expectedVersion}.`),
      )
    }
  })
}

function ensureMigrationTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS SchemaMigrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    ) STRICT;
  `)
}

function appliedVersions(database: Database.Database): Set<number> {
  const rows = database
    .prepare('SELECT version FROM SchemaMigrations ORDER BY version ASC')
    .all() as Array<{ version: number }>

  return new Set(rows.map((row) => row.version))
}

export function runMigrations(
  database: Database.Database,
  migrations: readonly Migration[] = MIGRATIONS,
): void {
  validateMigrationSequence(migrations)
  ensureMigrationTable(database)

  const applied = appliedVersions(database)
  const latestKnownVersion = migrations.at(-1)?.version ?? 0
  const newerVersion = [...applied].find((version) => version > latestKnownVersion)

  if (newerVersion !== undefined) {
    throw new DatabaseMigrationError(
      newerVersion,
      new Error('Veritabanı bu uygulama sürümünden daha yeni.'),
    )
  }

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue
    }

    const applyMigration = database.transaction(() => {
      migration.up(database)
      database
        .prepare(
          `INSERT INTO SchemaMigrations (version, name, appliedAt)
           VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        )
        .run(migration.version, migration.name)
      database.pragma(`user_version = ${migration.version}`)
    })

    try {
      applyMigration()
    } catch (error) {
      throw new DatabaseMigrationError(migration.version, error)
    }
  }
}
