// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { NoteService } from './note-service'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function createService(): NoteService {
  database = openDatabase(':memory:')
  const ids = ['source-id', 'duplicate-id']
  let index = 0

  return new NoteService(new NoteRepository(database), {
    createId: () => ids[index++] ?? `generated-${index}`,
    now: () => new Date('2026-07-28T15:00:00.000Z'),
  })
}

describe('NoteService mutations', () => {
  it('renames a note persistently', () => {
    const service = createService()
    const created = service.create({ title: 'Eski başlık' })

    const renamed = service.rename({ id: created.id, title: 'Yeni başlık' })

    expect(renamed.title).toBe('Yeni başlık')
    expect(service.list()).toContainEqual(renamed)
  })

  it('duplicates a note with a new id', () => {
    const service = createService()
    const created = service.create({ title: 'Kaynak' })

    const duplicate = service.duplicate({ id: created.id })

    expect(duplicate.id).toBe('duplicate-id')
    expect(duplicate.id).not.toBe(created.id)
    expect(duplicate.title).toBe('Kaynak (Kopya)')
    expect(service.list()).toHaveLength(2)
  })

  it('soft deletes a note from the active list', () => {
    const service = createService()
    const created = service.create({ title: 'Silinecek' })

    expect(service.softDelete({ id: created.id })).toEqual({ id: created.id })
    expect(service.list()).toEqual([])
  })

  it('persists a validated modular card size', () => {
    const service = createService()
    const created = service.create({ title: 'Yerleştirilecek' })

    expect(
      service.updateLayouts({
        layouts: [{ id: created.id, gridX: 6, gridY: 2, gridWidth: 6, gridHeight: 2 }],
      }),
    ).toEqual({ updatedIds: [created.id] })
    expect(service.list()[0]).toMatchObject({
      gridX: 6,
      gridY: 2,
      gridWidth: 6,
      gridHeight: 2,
    })
  })

  it('opens the requested note and records lastOpenedAt', () => {
    const service = createService()
    const created = service.create({ title: 'Açılacak not' })

    const opened = service.open({ id: created.id })

    expect(opened.id).toBe(created.id)
    expect(opened.lastOpenedAt).toBe('2026-07-28T15:00:00.000Z')
    expect(service.list()[0]?.lastOpenedAt).toBe('2026-07-28T15:00:00.000Z')
  })

  it('derives preview and searchText while saving the versioned editor envelope', () => {
    const service = createService()
    const created = service.create({ title: 'Taslak' })
    const document = {
      documentVersion: 1 as const,
      editor: 'tiptap' as const,
      content: {
        type: 'doc' as const,
        content: [
          {
            type: 'heading' as const,
            attrs: { level: 1 as const },
            content: [{ type: 'text' as const, text: 'Ürün planı' }],
          },
          {
            type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: 'Birinci adım tamamlandı.' }],
          },
        ],
      },
    }

    const saved = service.saveContent({ id: created.id, title: 'Plan', document })

    expect(saved.title).toBe('Plan')
    expect(saved.searchText).toBe('Ürün planı\nBirinci adım tamamlandı.')
    expect(saved.preview).toBe(saved.searchText)
    expect(JSON.parse(saved.contentJson)).toEqual(document)
  })
})
