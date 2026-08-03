// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from './note-repository'
import { ChatRepository } from './chat-repository'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('ChatRepository', () => {
  it('persists a note-scoped session and ordered messages', () => {
    database = openDatabase(':memory:')
    const notes = new NoteRepository(database)
    notes.insert({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Bağlam notu',
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
      createdAt: '2026-07-28T20:00:00.000Z',
      updatedAt: '2026-07-28T20:00:00.000Z',
    })
    const repository = new ChatRepository(database)
    const sessionId = '22222222-2222-4222-8222-222222222222'
    repository.insertSession({
      id: sessionId,
      noteId: '11111111-1111-4111-8111-111111111111',
      title: 'Bağlam notu sohbeti',
      createdAt: '2026-07-28T20:01:00.000Z',
      updatedAt: '2026-07-28T20:01:00.000Z',
    })
    repository.insertMessage({
      id: '33333333-3333-4333-8333-333333333333',
      sessionId,
      role: 'user',
      content: 'Özetle',
      status: 'complete',
      createdAt: '2026-07-28T20:02:00.000Z',
    })
    repository.insertMessage({
      id: '44444444-4444-4444-8444-444444444444',
      sessionId,
      role: 'assistant',
      content: '',
      status: 'pending',
      createdAt: '2026-07-28T20:03:00.000Z',
    })
    repository.updateMessage(
      '44444444-4444-4444-8444-444444444444',
      { content: 'Kısa özet', status: 'complete' },
      '2026-07-28T20:04:00.000Z',
    )

    expect(repository.findLatestSession('11111111-1111-4111-8111-111111111111')).toMatchObject({
      id: sessionId,
    })
    expect(
      repository.listMessages(sessionId).map(({ role, content, status }) => ({
        role,
        content,
        status,
      })),
    ).toEqual([
      { role: 'user', content: 'Özetle', status: 'complete' },
      { role: 'assistant', content: 'Kısa özet', status: 'complete' },
    ])
  })
})
