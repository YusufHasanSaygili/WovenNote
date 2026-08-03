// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import type { TiptapDocument } from '../../shared/schemas/editor-document'
import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { NoteVersionRepository } from '../repositories/note-version-repository'
import { NoteService } from './note-service'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function document(text: string): TiptapDocument {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
  }
}

function setup(): {
  advance: (milliseconds: number) => void
  notes: NoteService
  versions: NoteVersionRepository
} {
  database = openDatabase(':memory:')
  const noteRepository = new NoteRepository(database)
  const versions = new NoteVersionRepository(database)
  let nowMs = Date.parse('2026-07-28T18:00:00.000Z')
  let versionIndex = 0
  return {
    advance: (milliseconds) => {
      nowMs += milliseconds
    },
    notes: new NoteService(noteRepository, {
      createId: () => 'versioned-note',
      createVersionId: () => `version-${++versionIndex}`,
      now: () => new Date(nowMs),
      versionRepository: versions,
    }),
    versions,
  }
}

describe('note version checkpoints', () => {
  it('does not create a version for every small save burst', () => {
    const { notes, versions } = setup()
    const note = notes.create({ title: 'Sürümlü not' })

    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('a') },
    })
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('ab') },
    })
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('abc') },
    })

    expect(versions.countForNote(note.id)).toBe(1)
  })

  it('creates a checkpoint after ten minutes or a significant text change', () => {
    const { advance, notes, versions } = setup()
    const note = notes.create({ title: 'Checkpoint notu' })
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('ilk') },
    })
    advance(10 * 60 * 1_000)
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('ikinci') },
    })
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: {
        documentVersion: 1,
        editor: 'tiptap',
        content: document(`ikinci${'x'.repeat(500)}`),
      },
    })

    expect(versions.countForNote(note.id)).toBe(3)
    expect(notes.listVersions({ noteId: note.id }).map((version) => version.preview)).toEqual([
      'ikinci',
      'ilk',
      '',
    ])
  })

  it('restores a selected version and preserves the current content first', () => {
    const { advance, notes } = setup()
    const note = notes.create({ title: 'Geri yükleme notu' })
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('birinci içerik') },
    })
    advance(10 * 60 * 1_000)
    notes.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document('mevcut içerik') },
    })
    const target = notes
      .listVersions({ noteId: note.id })
      .find((version) => version.preview === 'birinci içerik')
    if (!target) throw new Error('Expected checkpoint was not created.')

    const restored = notes.restoreVersion({
      noteId: note.id,
      versionId: target.id,
      confirmation: 'RESTORE_VERSION',
    })

    expect(restored.searchText).toBe('birinci içerik')
    expect(notes.listVersions({ noteId: note.id })[0]).toMatchObject({
      preview: 'mevcut içerik',
      reason: 'restore',
    })
  })
})
