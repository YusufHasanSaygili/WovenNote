// @vitest-environment node

import type { IpcMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import type Database from 'better-sqlite3'
import { ALLOWED_IPC_CHANNELS, NOTE_CHANNELS } from '../../shared/ipc-channels'
import {
  CreateNoteResultSchema,
  ListNotesResultSchema,
  SearchNotesResultSchema,
  PermanentlyDeleteNoteResultSchema,
  UpdateNoteLayoutsResultSchema,
} from '../../shared/schemas/note-contracts'
import {
  ListNoteVersionsResultSchema,
  RestoreNoteVersionResultSchema,
} from '../../shared/schemas/note-version-contracts'
import { NoteRepository } from '../repositories/note-repository'
import { NoteVersionRepository } from '../repositories/note-version-repository'
import { NoteService } from '../services/note-service'
import { registerNoteIpcHandlers } from './note-ipc'

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

function setupContract(): { ipc: FakeIpcMain; repository: NoteRepository } {
  database = openDatabase(':memory:')
  const repository = new NoteRepository(database)
  const service = new NoteService(repository, {
    createId: () => 'contract-note-001',
    now: () => new Date('2026-07-28T14:00:00.000Z'),
  })
  const ipc = new FakeIpcMain()

  registerNoteIpcHandlers(ipc as unknown as IpcMain, service)
  return { ipc, repository }
}

describe('note IPC contracts', () => {
  it('creates and lists a note through valid contract payloads', async () => {
    const { ipc } = setupContract()
    const create = ipc.handlers.get(NOTE_CHANNELS.create)!
    const list = ipc.handlers.get(NOTE_CHANNELS.list)!

    const created = CreateNoteResultSchema.parse(await create({}, { title: '  Sözleşme notu  ' }))
    const listed = ListNotesResultSchema.parse(await list({}, {}))

    expect(created).toMatchObject({ ok: true, data: { title: 'Sözleşme notu' } })
    expect(listed).toMatchObject({ ok: true, data: [{ id: 'contract-note-001' }] })
  })

  it('validates and runs a title/content search contract', async () => {
    const { ipc } = setupContract()
    await ipc.handlers.get(NOTE_CHANNELS.create)!({}, { title: 'İstanbul planı' })
    const search = ipc.handlers.get(NOTE_CHANNELS.search)!

    expect(SearchNotesResultSchema.parse(await search({}, { query: 'İSTANBUL' }))).toMatchObject({
      ok: true,
      data: [{ id: 'contract-note-001' }],
    })
    expect(
      SearchNotesResultSchema.parse(await search({}, { query: 'İstanbul', tagIds: ['future'] })),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects invalid and over-posted payloads without writing data', async () => {
    const { ipc, repository } = setupContract()
    const create = ipc.handlers.get(NOTE_CHANNELS.create)!

    const emptyTitle = CreateNoteResultSchema.parse(await create({}, { title: '   ' }))
    const extraField = CreateNoteResultSchema.parse(
      await create({}, { title: 'Not', unauthorized: true }),
    )

    expect(emptyTitle).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(extraField).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(repository.count()).toBe(0)
  })

  it('registers only the explicit allowlist and removes it cleanly', () => {
    database = openDatabase(':memory:')
    const ipc = new FakeIpcMain()
    const service = new NoteService(new NoteRepository(database))
    const unregister = registerNoteIpcHandlers(ipc as unknown as IpcMain, service)

    expect(new Set(ipc.handlers.keys())).toEqual(new Set(Object.values(NOTE_CHANNELS)))
    expect(ALLOWED_IPC_CHANNELS).toEqual(expect.arrayContaining([...ipc.handlers.keys()]))
    expect(ipc.handlers.has('filesystem:read')).toBe(false)

    unregister()
    expect(ipc.handlers.size).toBe(0)
  })

  it('validates layout bounds before writing and persists a valid batch', async () => {
    const { ipc, repository } = setupContract()
    await ipc.handlers.get(NOTE_CHANNELS.create)!({}, { title: 'Grid notu' })
    const updateLayouts = ipc.handlers.get(NOTE_CHANNELS.updateLayouts)!

    const tooWide = UpdateNoteLayoutsResultSchema.parse(
      await updateLayouts(
        {},
        {
          layouts: [{ id: 'contract-note-001', gridX: 0, gridY: 0, gridWidth: 7, gridHeight: 2 }],
        },
      ),
    )
    expect(tooWide).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const outsideBoard = UpdateNoteLayoutsResultSchema.parse(
      await updateLayouts(
        {},
        {
          layouts: [{ id: 'contract-note-001', gridX: 10, gridY: 0, gridWidth: 6, gridHeight: 2 }],
        },
      ),
    )
    expect(outsideBoard).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const valid = UpdateNoteLayoutsResultSchema.parse(
      await updateLayouts(
        {},
        {
          layouts: [{ id: 'contract-note-001', gridX: 6, gridY: 3, gridWidth: 6, gridHeight: 2 }],
        },
      ),
    )
    expect(valid).toEqual({ ok: true, data: { updatedIds: ['contract-note-001'] } })
    expect(repository.findById('contract-note-001')).toMatchObject({
      gridX: 6,
      gridY: 3,
      gridWidth: 6,
      gridHeight: 2,
    })
  })

  it('saves only a valid versioned Tiptap document', async () => {
    const { ipc, repository } = setupContract()
    await ipc.handlers.get(NOTE_CHANNELS.create)!({}, { title: 'Taslak' })
    const saveContent = ipc.handlers.get(NOTE_CHANNELS.saveContent)!
    const validDocument = {
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Sözleşme içeriği' }],
          },
        ],
      },
    }

    const valid = CreateNoteResultSchema.parse(
      await saveContent(
        {},
        { id: 'contract-note-001', title: 'Kaydedildi', document: validDocument },
      ),
    )
    const overPosted = CreateNoteResultSchema.parse(
      await saveContent(
        {},
        {
          id: 'contract-note-001',
          title: 'Yetkisiz',
          document: validDocument,
          preview: 'renderer değeri',
        },
      ),
    )

    expect(valid).toMatchObject({
      ok: true,
      data: { title: 'Kaydedildi', preview: 'Sözleşme içeriği', searchText: 'Sözleşme içeriği' },
    })
    expect(overPosted).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(repository.findById('contract-note-001')?.title).toBe('Kaydedildi')
  })

  it('requires explicit confirmation before permanent deletion', async () => {
    const { ipc, repository } = setupContract()
    await ipc.handlers.get(NOTE_CHANNELS.create)!({}, { title: 'Kalıcı silinecek' })
    await ipc.handlers.get(NOTE_CHANNELS.softDelete)!({}, { id: 'contract-note-001' })
    const permanentDelete = ipc.handlers.get(NOTE_CHANNELS.permanentlyDelete)!

    const unconfirmed = PermanentlyDeleteNoteResultSchema.parse(
      await permanentDelete({}, { id: 'contract-note-001' }),
    )
    expect(unconfirmed).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(repository.findById('contract-note-001')).not.toBeNull()

    const confirmed = PermanentlyDeleteNoteResultSchema.parse(
      await permanentDelete({}, { id: 'contract-note-001', confirmation: 'PERMANENT_DELETE' }),
    )
    expect(confirmed).toMatchObject({ ok: true, data: { id: 'contract-note-001' } })
    expect(repository.findById('contract-note-001')).toBeNull()
  })

  it('lists version previews and requires restore confirmation', async () => {
    database = openDatabase(':memory:')
    const repository = new NoteRepository(database)
    const ipc = new FakeIpcMain()
    registerNoteIpcHandlers(
      ipc as unknown as IpcMain,
      new NoteService(repository, {
        createId: () => 'version-contract-note',
        createVersionId: () => 'version-contract-001',
        now: () => new Date('2026-07-28T18:00:00.000Z'),
        versionRepository: new NoteVersionRepository(database),
      }),
    )
    await ipc.handlers.get(NOTE_CHANNELS.create)!({}, { title: 'Sürüm sözleşmesi' })
    await ipc.handlers.get(NOTE_CHANNELS.saveContent)!(
      {},
      {
        id: 'version-contract-note',
        title: 'Sürüm sözleşmesi',
        document: {
          documentVersion: 1,
          editor: 'tiptap',
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yeni' }] }],
          },
        },
      },
    )
    const listed = ListNoteVersionsResultSchema.parse(
      await ipc.handlers.get(NOTE_CHANNELS.listVersions)!({}, { noteId: 'version-contract-note' }),
    )
    expect(listed).toMatchObject({ ok: true, data: [{ id: 'version-contract-001', preview: '' }] })

    const unconfirmed = RestoreNoteVersionResultSchema.parse(
      await ipc.handlers.get(NOTE_CHANNELS.restoreVersion)!(
        {},
        {
          noteId: 'version-contract-note',
          versionId: 'version-contract-001',
        },
      ),
    )
    expect(unconfirmed).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(repository.findById('version-contract-note')?.searchText).toBe('Yeni')
  })
})
