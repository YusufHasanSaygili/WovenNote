import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

import Database from 'better-sqlite3'

import { runMigrations } from './migrations'
import { normalizeTurkishSearchText } from './search-normalization'

export class DatabaseInitializationError extends Error {
  constructor(cause?: unknown) {
    super('Yerel veritabanı başlatılamadı.', { cause })
    this.name = 'DatabaseInitializationError'
  }
}

export function openDatabase(databasePath: string): Database.Database {
  let database: Database.Database | undefined

  try {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true })
    }

    database = new Database(databasePath)
    const legacySearchFunctionName = ['note', 'gpt_search_fold'].join('')
    database.function(legacySearchFunctionName, { deterministic: true }, normalizeTurkishSearchText)
    database.function('wovennote_search_fold', { deterministic: true }, normalizeTurkishSearchText)
    database.pragma('foreign_keys = ON')
    database.pragma('busy_timeout = 5000')

    if (databasePath !== ':memory:') {
      database.pragma('journal_mode = WAL')
    }

    runMigrations(database)
    return database
  } catch (error) {
    if (database?.open) {
      database.close()
    }

    throw new DatabaseInitializationError(error)
  }
}

export function closeDatabase(database: Database.Database | undefined): void {
  if (database?.open) {
    database.close()
  }
}
