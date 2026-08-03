// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, DatabaseInitializationError, openDatabase } from './database'

let database: Database.Database | undefined
let temporaryDirectory: string | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined

  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { force: true, recursive: true })
    temporaryDirectory = undefined
  }
})

describe('openDatabase', () => {
  it('opens an isolated database with safety pragmas and migrations', () => {
    database = openDatabase(':memory:')

    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(database.pragma('busy_timeout', { simple: true })).toBe(5000)
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name = 'Notes'").get()).toEqual({
      name: 'Notes',
    })
    expect(database.pragma('user_version', { simple: true })).toBe(7)
    expect(
      database
        .prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_tags_normalized_name'")
        .get(),
    ).toEqual({
      sql: 'CREATE UNIQUE INDEX idx_tags_normalized_name\n        ON Tags (wovennote_search_fold(name))',
    })
  })

  it('wraps database opening failures in a safe application error', () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'wovennote-db-error-'))

    expect(() => openDatabase(temporaryDirectory!)).toThrowError(DatabaseInitializationError)

    try {
      openDatabase(temporaryDirectory)
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseInitializationError)
      expect((error as Error).message).toBe('Yerel veritabanı başlatılamadı.')
      expect((error as Error).message).not.toContain(temporaryDirectory)
    }
  })
})
