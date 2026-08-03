// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { AttachmentRepository } from '../repositories/attachment-repository'
import { NoteRepository } from '../repositories/note-repository'
import { NoteService } from './note-service'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function setup(ids = ['lifecycle-note']): {
  attachments: AttachmentRepository
  notes: NoteService
  repository: NoteRepository
} {
  database = openDatabase(':memory:')
  const repository = new NoteRepository(database)
  let idIndex = 0
  return {
    attachments: new AttachmentRepository(database),
    notes: new NoteService(repository, {
      createId: () => ids[idIndex++] ?? `generated-${idIndex}`,
      now: () => new Date('2026-07-28T17:00:00.000Z'),
    }),
    repository,
  }
}

describe('note lifecycle', () => {
  it('moves archived notes out of the active list and can unarchive them', () => {
    const { notes } = setup()
    const note = notes.create({ title: 'Arşivlenecek' })

    expect(notes.archive({ id: note.id })).toMatchObject({ id: note.id, isArchived: true })
    expect(notes.list()).toEqual([])
    expect(notes.listArchived()).toHaveLength(1)
    expect(notes.unarchive({ id: note.id })).toMatchObject({ id: note.id, isArchived: false })
    expect(notes.list()).toHaveLength(1)
  })

  it('restores a trashed note to the active list', () => {
    const { notes } = setup()
    const note = notes.create({ title: 'Geri gelecek' })

    notes.softDelete({ id: note.id })
    expect(notes.list()).toEqual([])
    expect(notes.listTrashed()).toHaveLength(1)
    expect(notes.restore({ id: note.id })).toMatchObject({ id: note.id, deletedAt: null })
    expect(notes.list()).toHaveLength(1)
  })

  it('preserves an attachment shared by a surviving duplicate during permanent deletion', async () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const attachments = new AttachmentRepository(database)
    const cleanupAttachmentFiles = vi.fn(async (paths: readonly string[]) => paths.length)
    const ids = ['source-note', 'duplicate-note']
    let idIndex = 0
    const notes = new NoteService(repository, {
      cleanupAttachmentFiles,
      createId: () => ids[idIndex++]!,
      now: () => new Date('2026-07-28T17:00:00.000Z'),
    })
    const source = notes.createWithContent('Dosyalı not', {
      type: 'doc',
      content: [
        {
          type: 'attachmentImage',
          attrs: {
            attachmentId: 'shared-attachment',
            alt: 'Ortak görsel',
            alignment: 'center',
            width: 100,
          },
        },
      ],
    })
    attachments.insert({
      id: 'shared-attachment',
      noteId: source.id,
      blockId: null,
      originalFileName: 'shared.png',
      storedFileName: 'shared-attachment.png',
      relativePath: 'shared-attachment.png',
      mimeType: 'image/png',
      fileSize: 10,
      width: 1,
      height: 1,
      createdAt: source.createdAt,
    })
    const duplicate = notes.duplicate({ id: source.id })
    notes.softDelete({ id: source.id })

    const deletion = await notes.permanentlyDelete({
      id: source.id,
      confirmation: 'PERMANENT_DELETE',
    })

    expect(deletion).toEqual({
      id: source.id,
      cleanedAttachmentFiles: 0,
      preservedSharedAttachments: 1,
    })
    expect(cleanupAttachmentFiles).toHaveBeenCalledWith([])
    expect(attachments.findById('shared-attachment')).toMatchObject({ noteId: duplicate.id })
    expect(repository.findById(source.id)).toBeNull()
  })

  it('cleans an unreferenced attachment only after its trashed note is deleted', async () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const attachments = new AttachmentRepository(database)
    const cleanupAttachmentFiles = vi.fn(async (paths: readonly string[]) => paths.length)
    const notes = new NoteService(repository, {
      cleanupAttachmentFiles,
      createId: () => 'unshared-note',
    })
    const note = notes.create({ title: 'Tekil dosya' })
    attachments.insert({
      id: 'unshared-attachment',
      noteId: note.id,
      blockId: null,
      originalFileName: 'only.pdf',
      storedFileName: 'unshared-attachment.pdf',
      relativePath: 'unshared-attachment.pdf',
      mimeType: 'application/pdf',
      fileSize: 10,
      width: null,
      height: null,
      createdAt: note.createdAt,
    })
    notes.softDelete({ id: note.id })

    expect(attachments.findById('unshared-attachment')).not.toBeNull()
    expect(
      await notes.permanentlyDelete({ id: note.id, confirmation: 'PERMANENT_DELETE' }),
    ).toMatchObject({ cleanedAttachmentFiles: 1, preservedSharedAttachments: 0 })
    expect(cleanupAttachmentFiles).toHaveBeenCalledWith(['unshared-attachment.pdf'])
    expect(attachments.findById('unshared-attachment')).toBeNull()
  })
})
