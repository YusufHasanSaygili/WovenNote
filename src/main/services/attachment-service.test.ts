// @vitest-environment node

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { AttachmentRepository } from '../repositories/attachment-repository'
import { NoteRepository, type NoteRecord } from '../repositories/note-repository'
import {
  AttachmentService,
  AttachmentStorageError,
  MAX_ATTACHMENT_BYTES,
  sanitizeAttachmentFileName,
} from './attachment-service'

let database: Database.Database | undefined
let temporaryRoot: string | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = undefined
})

function note(): NoteRecord {
  return {
    id: 'note-001',
    title: 'Dosyalı not',
    preview: '',
    searchText: '',
    contentJson: '{"documentVersion":1,"editor":"tiptap","content":{}}',
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
  }
}

function setup(
  sourcePath: string,
  maxAttachmentBytes?: number,
  openPath?: (filePath: string) => Promise<string>,
): {
  repository: AttachmentRepository
  service: AttachmentService
  storageRoot: string
} {
  database = openDatabase(':memory:')
  const noteRepository = new NoteRepository(database)
  noteRepository.insert(note())
  const repository = new AttachmentRepository(database)
  const storageRoot = join(temporaryRoot!, 'controlled-attachments')
  return {
    repository,
    storageRoot,
    service: new AttachmentService(repository, noteRepository, storageRoot, {
      chooseFile: async () => sourcePath,
      createId: () => 'attachment-001',
      maxAttachmentBytes,
      now: () => new Date('2026-07-28T18:10:00.000Z'),
      openPath,
    }),
  }
}

describe('AttachmentService', () => {
  it('copies a verified file into the controlled root and stores path metadata only in DB', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, '..sunum.PNG')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
    writeFileSync(sourcePath, bytes)
    const { repository, service, storageRoot } = setup(sourcePath)

    const outcome = await service.pickAndStore({ noteId: 'note-001' })

    expect(outcome).toEqual({
      status: 'stored',
      attachment: {
        id: 'attachment-001',
        noteId: 'note-001',
        blockId: null,
        originalFileName: 'sunum.PNG',
        mimeType: 'image/png',
        fileSize: bytes.length,
        width: null,
        height: null,
        createdAt: '2026-07-28T18:10:00.000Z',
      },
    })
    const stored = repository.findById('attachment-001')!
    expect(stored.relativePath).toBe('attachment-001.png')
    expect(stored.relativePath).not.toContain('..')
    expect(readFileSync(join(storageRoot, stored.relativePath))).toEqual(bytes)
    expect(outcome).not.toHaveProperty('attachment.relativePath')
    expect(service.resolveStoredFile('attachment-001')).toEqual({
      filePath: join(storageRoot, 'attachment-001.png'),
      mimeType: 'image/png',
    })
  })

  it.each(['jpg', 'jpeg', 'jpe', 'jfif'])(
    'accepts a verified .%s JPEG image',
    async (extension) => {
      temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
      const sourcePath = join(temporaryRoot, `foto.${extension}`)
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0])
      writeFileSync(sourcePath, bytes)
      const { repository, service, storageRoot } = setup(sourcePath)

      await expect(
        service.pickAndStore({ noteId: 'note-001', accept: 'image' }),
      ).resolves.toMatchObject({
        status: 'stored',
        attachment: { mimeType: 'image/jpeg', originalFileName: `foto.${extension}` },
      })
      expect(repository.findById('attachment-001')).toMatchObject({
        mimeType: 'image/jpeg',
        relativePath: `attachment-001.${extension}`,
      })
      expect(readFileSync(join(storageRoot, `attachment-001.${extension}`))).toEqual(bytes)
    },
  )

  it('keeps a verified JPEG out of the PDF and general-file route', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'gerçek-fotoğraf.JPG')
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0])
    writeFileSync(sourcePath, bytes)
    const { service } = setup(sourcePath)

    await expect(service.pickAndStore({ noteId: 'note-001', accept: 'file' })).rejects.toThrow(
      'Resim ve videolar kendi ekleme düğmeleriyle eklenmelidir.',
    )
  })

  it('rejects an unsafe generated id before creating a traversal destination', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'görsel.png')
    writeFileSync(sourcePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    database = openDatabase(':memory:')
    const noteRepository = new NoteRepository(database)
    noteRepository.insert(note())
    const repository = new AttachmentRepository(database)
    const storageRoot = join(temporaryRoot, 'controlled-attachments')
    const service = new AttachmentService(repository, noteRepository, storageRoot, {
      chooseFile: async () => sourcePath,
      createId: () => '../../outside',
    })

    await expect(service.pickAndStore({ noteId: 'note-001' })).rejects.toThrow('güvenli bir kimlik')
    expect(repository.count()).toBe(0)
    expect(existsSync(join(temporaryRoot, 'outside.png'))).toBe(false)
  })

  it('rejects oversized and extension-spoofed files with understandable errors', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'sahte.png')
    writeFileSync(sourcePath, 'gerçek PNG değil')

    await expect(setup(sourcePath, 4).service.pickAndStore({ noteId: 'note-001' })).rejects.toEqual(
      expect.objectContaining<Partial<AttachmentStorageError>>({
        publicMessage: 'Dosya 4 bayt boyut sınırını aşıyor.',
      }),
    )

    closeDatabase(database)
    database = undefined
    await expect(setup(sourcePath).service.pickAndStore({ noteId: 'note-001' })).rejects.toThrow(
      'Bu dosya türü desteklenmiyor',
    )
  })

  it('rejects a sparse file above the real 100 MB media limit before copying it', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'çok-büyük.mp4')
    writeFileSync(sourcePath, Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]))
    truncateSync(sourcePath, MAX_ATTACHMENT_BYTES + 1)
    const { repository, service, storageRoot } = setup(sourcePath)

    await expect(service.pickAndStore({ noteId: 'note-001', accept: 'video' })).rejects.toThrow(
      'Dosya 100 MB boyut sınırını aşıyor.',
    )
    expect(repository.count()).toBe(0)
    expect(existsSync(storageRoot)).toBe(false)
  })

  it('returns cancellation without writing metadata or creating storage', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    database = openDatabase(':memory:')
    const noteRepository = new NoteRepository(database)
    noteRepository.insert(note())
    const repository = new AttachmentRepository(database)
    const storageRoot = join(temporaryRoot, 'controlled-attachments')
    const service = new AttachmentService(repository, noteRepository, storageRoot, {
      chooseFile: async () => null,
    })

    await expect(service.pickAndStore({ noteId: 'note-001' })).resolves.toEqual({
      status: 'cancelled',
    })
    expect(repository.count()).toBe(0)
    expect(existsSync(storageRoot)).toBe(false)
  })

  it('rejects a valid non-image when the picker is restricted to images', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'belge.pdf')
    writeFileSync(sourcePath, '%PDF-1.7\nexample')
    const { repository, service } = setup(sourcePath)

    await expect(service.pickAndStore({ noteId: 'note-001', accept: 'image' })).rejects.toThrow(
      'bir görsel veya GIF değil',
    )
    expect(repository.count()).toBe(0)
  })

  it('sanitizes path syntax and control characters from display names', () => {
    expect(sanitizeAttachmentFileName('../\u0000rapor:*?.pdf')).toBe('_rapor___.pdf')
  })

  it('opens only the repository-resolved controlled file and reports a missing file', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'rapor.pdf')
    writeFileSync(sourcePath, '%PDF-1.7\nexample')
    const openPath = vi.fn(async () => '')
    const { service, storageRoot } = setup(sourcePath, undefined, openPath)
    await service.pickAndStore({ noteId: 'note-001', accept: 'file' })

    await expect(service.openExternal({ attachmentId: 'attachment-001' })).resolves.toEqual({
      opened: true,
    })
    expect(openPath).toHaveBeenCalledWith(join(storageRoot, 'attachment-001.pdf'))

    unlinkSync(join(storageRoot, 'attachment-001.pdf'))
    await expect(service.openExternal({ attachmentId: 'attachment-001' })).rejects.toThrow(
      'artık güvenli saklama alanında bulunamıyor',
    )
    expect(openPath).toHaveBeenCalledTimes(1)
  })

  it('deletes only explicitly listed orphan files inside the controlled root', async () => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'wovennote-attachment-'))
    const sourcePath = join(temporaryRoot, 'temizlenecek.pdf')
    const outsidePath = join(temporaryRoot, 'korunacak.txt')
    writeFileSync(sourcePath, '%PDF-1.7\nexample')
    writeFileSync(outsidePath, 'keep')
    const { service, storageRoot } = setup(sourcePath)
    await service.pickAndStore({ noteId: 'note-001', accept: 'file' })

    await expect(
      service.deleteOrphanedFiles(['attachment-001.pdf', '../korunacak.txt']),
    ).resolves.toBe(1)
    expect(existsSync(join(storageRoot, 'attachment-001.pdf'))).toBe(false)
    expect(existsSync(outsidePath)).toBe(true)
  })
})
