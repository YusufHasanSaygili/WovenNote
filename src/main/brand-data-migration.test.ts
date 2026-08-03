// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { migrateLegacyUserData } from './brand-data-migration'

const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'wovennote-brand-migration-'))
  temporaryDirectories.push(directory)
  return directory
}

function legacyProductName(): string {
  return ['Note', 'GPT'].join('')
}

function legacyDatabaseName(): string {
  return ['note', 'gpt.sqlite3'].join('')
}

function seedDatabase(filePath: string, value: string): void {
  const database = new Database(filePath)
  database.exec('CREATE TABLE BrandMigrationTest (value TEXT NOT NULL) STRICT;')
  database.prepare('INSERT INTO BrandMigrationTest (value) VALUES (?)').run(value)
  database.close()
}

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true, force: true }))
})

describe('migrateLegacyUserData', () => {
  it('copies the legacy database, attachments, and encrypted secrets without deleting the source', async () => {
    const appDataDirectory = temporaryDirectory()
    const sourceDirectory = join(appDataDirectory, legacyProductName())
    const targetDirectory = join(appDataDirectory, 'WovenNote')
    mkdirSync(join(sourceDirectory, 'attachments'), { recursive: true })
    mkdirSync(join(sourceDirectory, 'secrets'), { recursive: true })
    seedDatabase(join(sourceDirectory, legacyDatabaseName()), 'legacy-note')
    writeFileSync(join(sourceDirectory, 'attachments', 'media.png'), Buffer.from([1, 2, 3]))
    writeFileSync(join(sourceDirectory, 'secrets', 'openai-api-key.bin'), Buffer.from([4, 5, 6]))

    await expect(migrateLegacyUserData(appDataDirectory, targetDirectory)).resolves.toEqual({
      migrated: true,
      sourceDirectory,
      targetDirectory,
    })

    const migratedDatabase = new Database(join(targetDirectory, 'wovennote.sqlite3'), {
      readonly: true,
    })
    expect(migratedDatabase.prepare('SELECT value FROM BrandMigrationTest').get()).toEqual({
      value: 'legacy-note',
    })
    migratedDatabase.close()
    expect(readFileSync(join(targetDirectory, 'attachments', 'media.png'))).toEqual(
      Buffer.from([1, 2, 3]),
    )
    expect(readFileSync(join(targetDirectory, 'secrets', 'openai-api-key.bin'))).toEqual(
      Buffer.from([4, 5, 6]),
    )
    expect(existsSync(join(sourceDirectory, legacyDatabaseName()))).toBe(true)
  })

  it('does not replace an existing WovenNote database', async () => {
    const appDataDirectory = temporaryDirectory()
    const sourceDirectory = join(appDataDirectory, legacyProductName())
    const targetDirectory = join(appDataDirectory, 'WovenNote')
    mkdirSync(sourceDirectory, { recursive: true })
    mkdirSync(targetDirectory, { recursive: true })
    seedDatabase(join(sourceDirectory, legacyDatabaseName()), 'legacy-note')
    seedDatabase(join(targetDirectory, 'wovennote.sqlite3'), 'current-note')

    await expect(migrateLegacyUserData(appDataDirectory, targetDirectory)).resolves.toEqual({
      migrated: false,
      sourceDirectory: null,
      targetDirectory,
    })

    const currentDatabase = new Database(join(targetDirectory, 'wovennote.sqlite3'), {
      readonly: true,
    })
    expect(currentDatabase.prepare('SELECT value FROM BrandMigrationTest').get()).toEqual({
      value: 'current-note',
    })
    currentDatabase.close()
  })
})
