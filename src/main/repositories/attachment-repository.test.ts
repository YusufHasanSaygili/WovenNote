// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { AttachmentRepository, type AttachmentRecord } from './attachment-repository'
import { NoteRepository, type NoteRecord } from './note-repository'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function note(): NoteRecord {
  return {
    id: 'note-attachment-001',
    title: 'Ekli not',
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

function attachment(): AttachmentRecord {
  return {
    id: 'attachment-001',
    noteId: 'note-attachment-001',
    blockId: null,
    originalFileName: 'görsel.png',
    storedFileName: 'attachment-001.png',
    relativePath: 'attachment-001.png',
    mimeType: 'image/png',
    fileSize: 42,
    width: null,
    height: null,
    createdAt: '2026-07-28T18:01:00.000Z',
  }
}

describe('AttachmentRepository', () => {
  it('persists complete metadata without exposing filesystem behavior to Notes', () => {
    database = openDatabase(':memory:')
    new NoteRepository(database).insert(note())
    const repository = new AttachmentRepository(database)
    const record = attachment()

    repository.insert(record)

    expect(repository.findById(record.id)).toEqual(record)
    expect(repository.listForNote(record.noteId)).toEqual([record])
    expect(repository.count()).toBe(1)
  })

  it('enforces note ownership through a foreign key', () => {
    database = openDatabase(':memory:')
    const repository = new AttachmentRepository(database)

    expect(() => repository.insert(attachment())).toThrow()
    expect(repository.count()).toBe(0)
  })
})
