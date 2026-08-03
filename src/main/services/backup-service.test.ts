// @vitest-environment node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { BackupManifestSchema } from '../../shared/schemas/backup-contracts'
import { closeDatabase, openDatabase } from '../database/database'
import { AttachmentRepository } from '../repositories/attachment-repository'
import { NoteRepository } from '../repositories/note-repository'
import { decodeBackupArchive, encodeBackupArchive } from './backup-archive'
import { BackupService } from './backup-service'
import { NoteService } from './note-service'

const databases: Database.Database[] = []
const temporaryRoots: string[] = []

afterEach(() => {
  databases.splice(0).forEach((database) => closeDatabase(database))
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function temporaryRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `wovennote-${label}-`))
  temporaryRoots.push(root)
  return root
}

function databaseAt(filePath: string): Database.Database {
  const database = openDatabase(filePath)
  databases.push(database)
  return database
}

function seedRichProfile(database: Database.Database, attachmentRoot: string): void {
  const notes = new NoteRepository(database)
  const service = new NoteService(notes, {
    createId: () => 'portable-note-001',
    now: () => new Date('2026-07-28T18:00:00.000Z'),
  })
  service.create({ title: 'Taşınabilir not' })
  service.saveContent({
    id: 'portable-note-001',
    title: 'Taşınabilir not',
    document: {
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Temiz profile taşınır' }] },
          {
            type: 'attachmentImage',
            attrs: {
              attachmentId: 'portable-media-001',
              alt: 'Taşınabilir görsel',
              alignment: 'center',
              width: 50,
            },
          },
        ],
      },
    },
  })
  const media = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
  mkdirSync(attachmentRoot, { recursive: true })
  writeFileSync(join(attachmentRoot, 'portable-media-001.png'), media)
  new AttachmentRepository(database).insert({
    id: 'portable-media-001',
    noteId: 'portable-note-001',
    blockId: null,
    originalFileName: 'taşınabilir.png',
    storedFileName: 'portable-media-001.png',
    relativePath: 'portable-media-001.png',
    mimeType: 'image/png',
    fileSize: media.length,
    width: 640,
    height: 480,
    createdAt: '2026-07-28T18:00:00.000Z',
  })
  database
    .prepare('INSERT INTO Tags (id, name, color, createdAt) VALUES (?, ?, ?, ?)')
    .run('portable-tag-001', 'Taşınabilir', '#5364d8', '2026-07-28T18:00:00.000Z')
  database
    .prepare('INSERT INTO NoteTags (noteId, tagId) VALUES (?, ?)')
    .run('portable-note-001', 'portable-tag-001')
  database
    .prepare(
      'INSERT INTO ChatSessions (id, noteId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      'portable-session-001',
      'portable-note-001',
      'Sohbet',
      '2026-07-28T18:00:00.000Z',
      '2026-07-28T18:00:00.000Z',
    )
  database
    .prepare(
      'INSERT INTO ChatMessages (id, sessionId, role, content, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      'portable-message-001',
      'portable-session-001',
      'user',
      'Yedekteyim',
      'complete',
      '2026-07-28T18:00:00.000Z',
    )
  database
    .prepare(
      'INSERT INTO NoteVersions (id, noteId, contentJson, reason, createdAt) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      'portable-version-001',
      'portable-note-001',
      notes.findById('portable-note-001')!.contentJson,
      'autosave',
      '2026-07-28T18:00:00.000Z',
    )
  const insertSetting = database.prepare(
    'INSERT INTO Settings (key, valueJson, updatedAt) VALUES (?, ?, ?)',
  )
  insertSetting.run(
    'note-detail-layout',
    JSON.stringify({ aiPanelPercentage: 30 }),
    '2026-07-28T18:00:00.000Z',
  )
  insertSetting.run(
    'api-key-unsafe-test',
    JSON.stringify({ apiKey: 'sk-super-secret-never-back-up' }),
    '2026-07-28T18:00:00.000Z',
  )
}

async function createRichBackup(): Promise<{
  readonly backupPath: string
  readonly archiveBytes: Buffer
}> {
  const sourceRoot = temporaryRoot('backup-source')
  const sourceDatabase = databaseAt(join(sourceRoot, 'wovennote.sqlite3'))
  const sourceAttachments = join(sourceRoot, 'attachments')
  seedRichProfile(sourceDatabase, sourceAttachments)
  const backupPath = join(sourceRoot, 'portable.wovennote-backup')
  const service = new BackupService(
    sourceDatabase,
    sourceAttachments,
    join(sourceRoot, 'staging'),
    {
      chooseBackupDestination: async () => backupPath,
      chooseBackupSource: async () => null,
      now: () => new Date('2026-07-28T20:00:00.000Z'),
    },
  )
  await expect(service.createBackup()).resolves.toMatchObject({
    status: 'saved',
    notes: 1,
    attachments: 1,
  })
  return { backupPath, archiveBytes: readFileSync(backupPath) }
}

function noteOnlyBackup(filePath: string, title: string): void {
  const contentJson = JSON.stringify({ documentVersion: 1, editor: 'tiptap', content: {} })
  const manifest = BackupManifestSchema.parse({
    format: 'wovennote-backup',
    backupVersion: 1,
    schemaVersion: 7,
    createdAt: '2026-07-28T20:00:00.000Z',
    data: {
      notes: [
        {
          id: 'conflict-note-001',
          title,
          preview: '',
          searchText: '',
          contentJson,
          color: '#fff4bd',
          gridX: 0,
          gridY: 0,
          gridWidth: 3,
          gridHeight: 4,
          isPinned: false,
          isFavorite: false,
          isArchived: false,
          deletedAt: null,
          lastOpenedAt: null,
          createdAt: '2026-07-28T18:00:00.000Z',
          updatedAt: '2026-07-28T18:00:00.000Z',
        },
      ],
      tags: [],
      noteTags: [],
      attachments: [],
      chatSessions: [],
      chatMessages: [],
      noteVersions: [],
      settings: [],
    },
  })
  writeFileSync(filePath, encodeBackupArchive(manifest, new Map()))
}

describe('BackupService', () => {
  it('restores database records and media into another clean profile without secrets', async () => {
    const { backupPath, archiveBytes } = await createRichBackup()
    const decoded = decodeBackupArchive(archiveBytes)
    expect(decoded.manifest.data.settings.map((setting) => setting.key)).toEqual([
      'note-detail-layout',
    ])
    expect(JSON.stringify(decoded.manifest)).not.toContain('sk-super-secret-never-back-up')

    const targetRoot = temporaryRoot('backup-target')
    const targetDatabase = databaseAt(join(targetRoot, 'wovennote.sqlite3'))
    const targetAttachments = join(targetRoot, 'attachments')
    let id = 0
    const service = new BackupService(
      targetDatabase,
      targetAttachments,
      join(targetRoot, 'staging'),
      {
        chooseBackupDestination: async () => null,
        chooseBackupSource: async () => backupPath,
        createId: () => `restored-${++id}`,
        now: () => new Date('2026-07-28T20:05:00.000Z'),
      },
    )
    const inspected = await service.inspectBackup()
    expect(inspected).toMatchObject({
      status: 'ready',
      summary: { notes: 1, attachments: 1, chatMessages: 1, noteConflicts: 0 },
    })
    if (inspected.status !== 'ready') throw new Error('Backup was unexpectedly cancelled.')
    await expect(
      service.restoreBackup(inspected.importToken, 'keep-existing'),
    ).resolves.toMatchObject({
      status: 'restored',
      notesImported: 1,
      notesSkipped: 0,
      attachmentsImported: 1,
    })

    const restoredNote = new NoteRepository(targetDatabase).findById('portable-note-001')!
    const restoredAttachment = new AttachmentRepository(targetDatabase).listForNote(
      'portable-note-001',
    )[0]!
    expect(restoredNote.title).toBe('Taşınabilir not')
    expect(restoredNote.contentJson).toContain(restoredAttachment.id)
    expect(restoredNote.contentJson).not.toContain('portable-media-001')
    expect(readFileSync(join(targetAttachments, restoredAttachment.relativePath))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]),
    )
    expect(
      (
        targetDatabase.prepare('SELECT COUNT(*) AS count FROM ChatMessages').get() as {
          count: number
        }
      ).count,
    ).toBe(1)
    expect(
      (
        targetDatabase.prepare('SELECT COUNT(*) AS count FROM NoteVersions').get() as {
          count: number
        }
      ).count,
    ).toBe(1)
    expect(
      (targetDatabase.prepare('SELECT COUNT(*) AS count FROM NoteTags').get() as { count: number })
        .count,
    ).toBe(1)
    expect(
      targetDatabase.prepare('SELECT key FROM Settings ORDER BY key').all() as Array<{
        key: string
      }>,
    ).toEqual([{ key: 'note-detail-layout' }])
  })

  it.each([
    ['keep-existing', ['Mevcut'], 1, 1],
    ['replace', ['Gelen'], 1, 0],
    ['keep-both', ['Gelen', 'Mevcut'], 2, 0],
  ] as const)(
    'applies the %s note conflict strategy',
    async (strategy, expectedTitles, expectedCount, expectedSkipped) => {
      const root = temporaryRoot(`conflict-${strategy}`)
      const backupPath = join(root, 'conflict.wovennote-backup')
      noteOnlyBackup(backupPath, 'Gelen')
      const database = databaseAt(join(root, 'target.sqlite3'))
      new NoteService(new NoteRepository(database), {
        createId: () => 'conflict-note-001',
        now: () => new Date('2026-07-28T18:00:00.000Z'),
      }).create({ title: 'Mevcut' })
      let id = 0
      const service = new BackupService(
        database,
        join(root, 'attachments'),
        join(root, 'staging'),
        {
          chooseBackupDestination: async () => null,
          chooseBackupSource: async () => backupPath,
          createId: () => `conflict-copy-${++id}`,
        },
      )
      const inspected = await service.inspectBackup()
      if (inspected.status !== 'ready') throw new Error('Backup was unexpectedly cancelled.')
      expect(inspected.summary.noteConflicts).toBe(1)

      await expect(service.restoreBackup(inspected.importToken, strategy)).resolves.toMatchObject({
        notesSkipped: expectedSkipped,
      })
      const rows = database.prepare('SELECT title FROM Notes ORDER BY title').all() as Array<{
        title: string
      }>
      expect(rows).toHaveLength(expectedCount)
      expect(rows.map((row) => row.title)).toEqual(expectedTitles)
    },
  )

  it('rolls back all database rows and installed files when media installation fails', async () => {
    const { backupPath } = await createRichBackup()
    const targetRoot = temporaryRoot('backup-rollback')
    const database = databaseAt(join(targetRoot, 'wovennote.sqlite3'))
    const attachmentRoot = join(targetRoot, 'attachments')
    let id = 0
    const service = new BackupService(database, attachmentRoot, join(targetRoot, 'staging'), {
      chooseBackupDestination: async () => null,
      chooseBackupSource: async () => backupPath,
      createId: () => `rollback-${++id}`,
      installStagedFile: async () => {
        throw new Error('Simulated disk failure')
      },
    })
    const inspected = await service.inspectBackup()
    if (inspected.status !== 'ready') throw new Error('Backup was unexpectedly cancelled.')

    await expect(service.restoreBackup(inspected.importToken, 'keep-existing')).rejects.toThrow(
      'Yapılan değişiklikler geri alındı',
    )
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM Notes').get() as { count: number }).count,
    ).toBe(0)
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM Attachments').get() as { count: number })
        .count,
    ).toBe(0)
    expect(existsSync(attachmentRoot) ? readdirSync(attachmentRoot) : []).toEqual([])
  })

  it('rejects a corrupt backup before creating an import session or changing data', async () => {
    const root = temporaryRoot('backup-corrupt')
    const backupPath = join(root, 'corrupt.wovennote-backup')
    writeFileSync(backupPath, 'not a zip')
    const database = databaseAt(join(root, 'wovennote.sqlite3'))
    const service = new BackupService(database, join(root, 'attachments'), join(root, 'staging'), {
      chooseBackupDestination: async () => null,
      chooseBackupSource: async () => backupPath,
    })

    await expect(service.inspectBackup()).rejects.toThrow('geçersiz, bozuk')
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM Notes').get() as { count: number }).count,
    ).toBe(0)
  })
})
