// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { TagRepository } from '../repositories/tag-repository'
import { NoteService } from './note-service'
import { OrganizationError, OrganizationService } from './organization-service'

let database: Database.Database | undefined
let tempDirectory: string | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true })
  tempDirectory = undefined
})

function createServices(connection: Database.Database): {
  notes: NoteService
  organization: OrganizationService
} {
  const noteRepository = new NoteRepository(connection)
  let tagIndex = 0
  return {
    notes: new NoteService(noteRepository, {
      createId: () => 'organization-note',
      now: () => new Date('2026-07-28T16:00:00.000Z'),
    }),
    organization: new OrganizationService(noteRepository, new TagRepository(connection), {
      createId: () => `tag-${++tagIndex}`,
      now: () => new Date('2026-07-28T16:01:00.000Z'),
    }),
  }
}

describe('OrganizationService', () => {
  it('assigns multiple validated tags and finds the note by a tag name', () => {
    database = openDatabase(':memory:')
    const { notes, organization } = createServices(database)
    const note = notes.create({ title: 'Kaynak not' })
    const research = organization.createTag({ name: 'Araştırma', color: '#5364d8' })
    const urgent = organization.createTag({ name: 'Acil', color: '#b42318' })

    const updated = organization.setNoteTags({ noteId: note.id, tagIds: [research.id, urgent.id] })

    expect(updated.tags).toEqual([urgent, research])
    expect(notes.search({ query: 'ARAŞTIRMA' })).toContainEqual(updated)
    expect(() => organization.createTag({ name: '  araştırma ', color: '#047857' })).toThrow(
      OrganizationError,
    )
  })

  it('rolls tag assignment back when any tag does not exist', () => {
    database = openDatabase(':memory:')
    const { notes, organization } = createServices(database)
    const note = notes.create({ title: 'Korunacak not' })
    const tag = organization.createTag({ name: 'Geçerli', color: '#047857' })
    organization.setNoteTags({ noteId: note.id, tagIds: [tag.id] })

    expect(() =>
      organization.setNoteTags({ noteId: note.id, tagIds: [tag.id, 'missing-tag'] }),
    ).toThrow()
    expect(notes.list()[0]?.tags).toEqual([tag])
  })

  it('preserves tags, pin and favorite state after the database is reopened', () => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'wovennote-organization-'))
    const databasePath = join(tempDirectory, 'wovennote.sqlite3')
    database = openDatabase(databasePath)
    const firstRun = createServices(database)
    const note = firstRun.notes.create({ title: 'Kalıcı durum' })
    const tag = firstRun.organization.createTag({ name: 'Kalıcı', color: '#1d4ed8' })
    firstRun.organization.setNoteTags({ noteId: note.id, tagIds: [tag.id] })
    firstRun.organization.setPinned({ id: note.id, value: true })
    firstRun.organization.setFavorite({ id: note.id, value: true })
    closeDatabase(database)

    database = openDatabase(databasePath)
    const reopenedNote = new NoteRepository(database).findById(note.id)

    expect(reopenedNote).toMatchObject({ isPinned: true, isFavorite: true })
    expect(reopenedNote?.tags).toEqual([tag])
  })
})
