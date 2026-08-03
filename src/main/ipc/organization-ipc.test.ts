// @vitest-environment node

import type Database from 'better-sqlite3'
import type { IpcMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'

import { ALLOWED_IPC_CHANNELS, ORGANIZATION_CHANNELS } from '../../shared/ipc-channels'
import {
  OrganizationNoteResultSchema,
  TagMutationResultSchema,
} from '../../shared/schemas/organization-contracts'
import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { TagRepository } from '../repositories/tag-repository'
import { NoteService } from '../services/note-service'
import { OrganizationService } from '../services/organization-service'
import { registerOrganizationIpcHandlers } from './organization-ipc'

type Handler = (event: unknown, payload: unknown) => Promise<unknown>

class FakeIpcMain {
  readonly handlers = new Map<string, Handler>()

  handle(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
}

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function setup(): { ipc: FakeIpcMain; noteId: string } {
  database = openDatabase(':memory:')
  const noteRepository = new NoteRepository(database)
  const noteId = new NoteService(noteRepository, { createId: () => 'note-tagged' }).create({
    title: 'IPC notu',
  }).id
  const ipc = new FakeIpcMain()
  registerOrganizationIpcHandlers(
    ipc as unknown as IpcMain,
    new OrganizationService(noteRepository, new TagRepository(database), {
      createId: () => 'tag-contract',
      now: () => new Date('2026-07-28T16:00:00.000Z'),
    }),
  )
  return { ipc, noteId }
}

describe('organization IPC contracts', () => {
  it('creates and assigns a tag through strict allowlisted contracts', async () => {
    const { ipc, noteId } = setup()
    const create = ipc.handlers.get(ORGANIZATION_CHANNELS.createTag)!
    const setTags = ipc.handlers.get(ORGANIZATION_CHANNELS.setNoteTags)!
    const created = TagMutationResultSchema.parse(
      await create({}, { name: '  Ürün   planı ', color: '#5364d8' }),
    )
    expect(created).toMatchObject({ ok: true, data: { id: 'tag-contract', name: 'Ürün planı' } })
    if (!created.ok) throw new Error('Tag creation unexpectedly failed.')

    const updated = OrganizationNoteResultSchema.parse(
      await setTags({}, { noteId, tagIds: [created.data.id] }),
    )
    expect(updated).toMatchObject({ ok: true, data: { tags: [{ name: 'Ürün planı' }] } })
    expect(ALLOWED_IPC_CHANNELS).toEqual(
      expect.arrayContaining(Object.values(ORGANIZATION_CHANNELS)),
    )
  })

  it('rejects invalid names, duplicate ids and over-posted flags', async () => {
    const { ipc, noteId } = setup()
    const create = ipc.handlers.get(ORGANIZATION_CHANNELS.createTag)!
    const setTags = ipc.handlers.get(ORGANIZATION_CHANNELS.setNoteTags)!
    const setPinned = ipc.handlers.get(ORGANIZATION_CHANNELS.setPinned)!

    expect(
      TagMutationResultSchema.parse(await create({}, { name: '!geçersiz', color: '#5364d8' })),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR' },
    })
    expect(
      OrganizationNoteResultSchema.parse(await setTags({}, { noteId, tagIds: ['same', 'same'] })),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(
      OrganizationNoteResultSchema.parse(
        await setPinned({}, { id: noteId, value: true, arbitrary: 'not-allowed' }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })
})
