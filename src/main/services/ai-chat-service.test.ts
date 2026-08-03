// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { ChatRepository } from '../repositories/chat-repository'
import { NoteRepository, type NoteRecord } from '../repositories/note-repository'
import { SettingsRepository } from '../repositories/settings-repository'
import { AiChatService } from './ai-chat-service'
import { AiSettingsService } from './ai-settings-service'
import type { SecretStore } from './encrypted-secret-store'
import { OpenAiResponseClient } from './openai-response-client'

let database: Database.Database | undefined

function note(id: string, title: string, text: string): NoteRecord {
  return {
    id,
    title,
    preview: text,
    searchText: text,
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      },
    }),
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
  }
}

function configuredSettings(repository: SettingsRepository): AiSettingsService {
  const secretStore: SecretStore = {
    isAvailable: () => true,
    has: () => true,
    read: () => 'sk-private-chat-test-key',
    remove: () => undefined,
    write: () => undefined,
  }
  return new AiSettingsService(repository, secretStore, { test: vi.fn() })
}

function ids(): () => string {
  const values = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
  ]
  return () => {
    const value = values.shift()
    if (!value) throw new Error('Test id pool exhausted.')
    return value
  }
}

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('AiChatService', () => {
  it('builds context from only the requested note and persists the note-scoped thread', async () => {
    database = openDatabase(':memory:')
    const notes = new NoteRepository(database)
    notes.insert(note('note-one', 'Birinci not', 'Sadece birinci nota ait içerik.'))
    notes.insert(note('note-two', 'İkinci not', 'BAŞKA NOTUN GİZLİ İÇERİĞİ'))
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Birinci özet.' }] }],
        usage: { input_tokens: 30, output_tokens: 4 },
      }),
    )
    const chats = new ChatRepository(database)
    const settings = configuredSettings(new SettingsRepository(database))
    const service = new AiChatService(
      chats,
      notes,
      settings,
      new OpenAiResponseClient(request),
      () => new Date('2026-07-28T20:10:00.000Z'),
      ids(),
    )

    const result = await service.sendMessage({
      noteId: 'note-one',
      requestId: '77777777-7777-4777-8777-777777777777',
      message: 'Bu notu özetle.',
    })

    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body)) as { input: string }
    expect(body.input).toContain('<title>Birinci not</title>')
    expect(body.input).toContain('Sadece birinci nota ait içerik.')
    expect(body.input).not.toContain('BAŞKA NOTUN GİZLİ İÇERİĞİ')
    expect(result.thread.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(result.thread.messages[1]).toMatchObject({ status: 'complete', content: /Birinci özet/ })

    const reopened = new AiChatService(
      chats,
      notes,
      settings,
      new OpenAiResponseClient(request),
    ).getThread('note-one')
    expect(reopened.messages).toEqual(result.thread.messages)
    expect(
      new AiChatService(chats, notes, settings, new OpenAiResponseClient(request)).getThread(
        'note-two',
      ).messages,
    ).toEqual([])
  })

  it('persists provider errors without crashing the chat', async () => {
    database = openDatabase(':memory:')
    const notes = new NoteRepository(database)
    notes.insert(note('note-error', 'Hata notu', 'Yerel içerik korunur.'))
    const service = new AiChatService(
      new ChatRepository(database),
      notes,
      configuredSettings(new SettingsRepository(database)),
      new OpenAiResponseClient(
        vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
      ),
      () => new Date('2026-07-28T20:20:00.000Z'),
      ids(),
    )

    await expect(
      service.sendMessage({
        noteId: 'note-error',
        requestId: '88888888-8888-4888-8888-888888888888',
        message: 'Yardım et.',
      }),
    ).resolves.toMatchObject({
      thread: { messages: [{ role: 'user' }, { role: 'assistant', status: 'error' }] },
    })
  })

  it('cancels an active request and stores its terminal state', async () => {
    database = openDatabase(':memory:')
    const notes = new NoteRepository(database)
    notes.insert(note('note-cancel', 'İptal notu', 'İptal edilebilir içerik.'))
    const waitsForAbort = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const service = new AiChatService(
      new ChatRepository(database),
      notes,
      configuredSettings(new SettingsRepository(database)),
      new OpenAiResponseClient(waitsForAbort),
      () => new Date('2026-07-28T20:30:00.000Z'),
      ids(),
    )
    const requestId = '99999999-9999-4999-8999-999999999999'
    const response = service.sendMessage({ noteId: 'note-cancel', requestId, message: 'Bekle.' })

    expect(service.cancelRequest(requestId)).toBe(true)
    await expect(response).resolves.toMatchObject({
      thread: { messages: [{ role: 'user' }, { role: 'assistant', status: 'cancelled' }] },
    })
    expect(service.cancelRequest(requestId)).toBe(false)
  })
})
