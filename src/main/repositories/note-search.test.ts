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

function note(id: string, title: string, searchText: string): NoteRecord {
  return {
    id,
    title,
    preview: searchText.slice(0, 240),
    searchText,
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
    createdAt: '2026-07-28T23:30:00.000Z',
    updatedAt: '2026-07-28T23:30:00.000Z',
  }
}

describe('NoteRepository search', () => {
  it('searches title and full text with Turkish-aware casing', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    repository.insert(note('turkish-note', 'İSTANBUL IŞIK PLANI', 'Derin çalışma İÇERİĞİ'))
    repository.insert(note('other-note', 'Ankara', 'Başka metin'))

    expect(repository.searchActive('istanbul').map((item) => item.id)).toEqual(['turkish-note'])
    expect(repository.searchActive('ışık').map((item) => item.id)).toEqual(['turkish-note'])
    expect(repository.searchActive('içeriği').map((item) => item.id)).toEqual(['turkish-note'])
  })

  it('keeps a bounded search responsive with a large local example set', () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const insertMany = database.transaction(() => {
      for (let index = 0; index < 3_000; index += 1) {
        repository.insert(
          note(
            `bulk-${index.toString().padStart(4, '0')}`,
            `Proje notu ${index}`,
            index === 2_731 ? 'benzersiz performans iğnesi' : `genel içerik ${index}`,
          ),
        )
      }
    })
    insertMany()

    const startedAt = performance.now()
    const result = repository.searchActive('PERFORMANS İĞNESİ')
    const elapsedMs = performance.now() - startedAt

    const listStartedAt = performance.now()
    const listed = repository.listActive()
    const listElapsedMs = performance.now() - listStartedAt

    expect(result.map((item) => item.id)).toEqual(['bulk-2731'])
    expect(elapsedMs).toBeLessThan(1_500)
    expect(listed).toHaveLength(3_000)
    expect(listElapsedMs).toBeLessThan(1_500)
  })
})
