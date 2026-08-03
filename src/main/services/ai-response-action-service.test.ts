// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { ChatRepository } from '../repositories/chat-repository'
import { NoteRepository } from '../repositories/note-repository'
import { AiResponseActionService, responseTextToDocument } from './ai-response-action-service'
import { NoteService } from './note-service'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('AiResponseActionService', () => {
  let chats: ChatRepository
  let notes: NoteRepository
  let noteService: NoteService
  let writeClipboard: ReturnType<typeof vi.fn<(text: string) => void>>
  let service: AiResponseActionService

  beforeEach(() => {
    database = openDatabase(':memory:')
    notes = new NoteRepository(database)
    chats = new ChatRepository(database)
    const generatedIds = ['note-one', 'created-from-ai']
    noteService = new NoteService(notes, {
      createId: () => generatedIds.shift() ?? 'unexpected-id',
      now: () => new Date('2026-07-28T22:00:00.000Z'),
    })
    writeClipboard = vi.fn()
    service = new AiResponseActionService(chats, notes, noteService, { writeClipboard })

    const source = noteService.create({ title: 'Kaynak not' })
    noteService.saveContent({
      id: source.id,
      title: source.title,
      document: {
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Özgün içerik' }] }],
        },
      },
    })
    chats.insertSession({
      id: SESSION_ID,
      noteId: source.id,
      title: 'Kaynak sohbeti',
      createdAt: '2026-07-28T22:01:00.000Z',
      updatedAt: '2026-07-28T22:01:00.000Z',
    })
    chats.insertMessage({
      id: MESSAGE_ID,
      sessionId: SESSION_ID,
      role: 'assistant',
      content: 'Birinci paragraf.\n\nİkinci paragraf.',
      status: 'complete',
      createdAt: '2026-07-28T22:02:00.000Z',
    })
  })

  it('appends only the completed response linked to the requested note', () => {
    const other = noteService.create({ title: 'Diğer not' })

    const updated = service.appendResponseToNote({ noteId: 'note-one', messageId: MESSAGE_ID })

    expect(updated.searchText).toContain('Özgün içerik')
    expect(updated.searchText).toContain('Birinci paragraf.')
    expect(updated.searchText).toContain('İkinci paragraf.')
    expect(notes.findById(other.id)?.searchText).toBe('')
    expect(() => service.appendResponseToNote({ noteId: other.id, messageId: MESSAGE_ID })).toThrow(
      'belirtilen nota ait değil',
    )
  })

  it('copies the verified response and creates a populated separate note', () => {
    expect(service.copyResponse({ noteId: 'note-one', messageId: MESSAGE_ID })).toEqual({
      copied: true,
    })
    expect(writeClipboard).toHaveBeenCalledWith('Birinci paragraf.\n\nİkinci paragraf.')

    const created = service.createNoteFromResponse({ noteId: 'note-one', messageId: MESSAGE_ID })
    expect(created.id).toBe('created-from-ai')
    expect(created.title).toBe('Kaynak not — AI yanıtı')
    expect(created.searchText).toBe('Birinci paragraf.\nİkinci paragraf.')
  })

  it('normalizes multiline output into bounded Tiptap paragraphs', () => {
    expect(responseTextToDocument('  İlk satır\n devamı\n\nSon bölüm  ')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'İlk satır devamı' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Son bölüm' }] },
      ],
    })
    expect(() => responseTextToDocument('   ')).toThrow('Boş bir AI yanıtı')
  })
})
