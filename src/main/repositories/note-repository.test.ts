// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository, type NoteRecord } from './note-repository'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function exampleNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: 'note-001',
    title: 'İlk not',
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
    createdAt: '2026-07-28T13:00:00.000Z',
    updatedAt: '2026-07-28T13:00:00.000Z',
    ...overrides,
  }
}

describe('NoteRepository', () => {
  it('persists and reads a complete note record', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const note = exampleNote({ isPinned: true, lastOpenedAt: '2026-07-28T13:01:00.000Z' })

    repository.insert(note)

    expect(repository.findById(note.id)).toEqual({ ...note, tags: [] })
    expect(repository.count()).toBe(1)
  })

  it('uses parameterized values without executing note content as SQL', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const note = exampleNote({ title: "'); DROP TABLE Notes; --" })

    repository.insert(note)

    expect(repository.findById(note.id)?.title).toBe(note.title)
    expect(repository.count()).toBe(1)
  })

  it('returns null for a missing note', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)

    expect(repository.findById('missing')).toBeNull()
  })

  it('updates card layouts together in one transaction', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    repository.insert(exampleNote())
    repository.insert(exampleNote({ id: 'note-002', gridX: 3 }))

    expect(
      repository.updateLayouts([
        { id: 'note-001', gridX: 5, gridY: 4, gridWidth: 7, gridHeight: 2 },
        { id: 'note-002', gridX: 0, gridY: 6, gridWidth: 4, gridHeight: 3 },
      ]),
    ).toEqual(['note-001', 'note-002'])
    expect(repository.findById('note-001')).toMatchObject({
      gridX: 5,
      gridY: 4,
      gridWidth: 7,
      gridHeight: 2,
    })
    expect(repository.findById('note-002')).toMatchObject({
      gridX: 0,
      gridY: 6,
      gridWidth: 4,
      gridHeight: 3,
    })
  })

  it('rolls back the whole layout batch when one note is missing', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    repository.insert(exampleNote())

    expect(() =>
      repository.updateLayouts([
        { id: 'note-001', gridX: 4, gridY: 1, gridWidth: 4, gridHeight: 3 },
        { id: 'missing', gridX: 0, gridY: 0, gridWidth: 3, gridHeight: 4 },
      ]),
    ).toThrow('Note not found.')
    expect(repository.findById('note-001')).toMatchObject({
      gridX: 0,
      gridY: 0,
      gridWidth: 3,
      gridHeight: 4,
    })
  })

  it('atomically updates title, content JSON, preview and search text', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const original = exampleNote()
    repository.insert(original)
    const contentJson =
      '{"documentVersion":1,"editor":"tiptap","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tam içerik"}]}]}}'

    const saved = repository.saveContent({
      id: original.id,
      title: 'Yeni başlık',
      contentJson,
      preview: 'Tam içerik',
      searchText: 'Tam içerik',
      updatedAt: '2026-07-28T17:00:00.000Z',
    })

    expect(saved).toMatchObject({
      title: 'Yeni başlık',
      contentJson,
      preview: 'Tam içerik',
      searchText: 'Tam içerik',
      updatedAt: '2026-07-28T17:00:00.000Z',
    })
  })
})
