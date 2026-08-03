// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { SettingsRepository } from '../repositories/settings-repository'
import { AiSettingsService } from './ai-settings-service'
import type { SecretStore } from './encrypted-secret-store'
import { inlineAiInstructionFor, InlineAiService } from './inline-ai-service'
import { NoteService } from './note-service'
import type { OpenAiResponseClient } from './openai-response-client'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('InlineAiService', () => {
  let generate: ReturnType<typeof vi.fn>
  let service: InlineAiService

  beforeEach(() => {
    database = openDatabase(':memory:')
    const notes = new NoteRepository(database)
    const noteService = new NoteService(notes, {
      createId: () => 'note-inline-ai',
      now: () => new Date('2026-07-28T23:00:00.000Z'),
    })
    const note = noteService.create({ title: 'AI seçim notu' })
    noteService.saveContent({
      id: note.id,
      title: note.title,
      document: {
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Seçilecek metin ve gönderilmeyecek bölüm.' }],
            },
          ],
        },
      },
    })
    const secretStore: SecretStore = {
      isAvailable: () => true,
      has: () => true,
      read: () => 'sk-inline-test-key',
      remove: () => undefined,
      write: () => undefined,
    }
    const settings = new AiSettingsService(new SettingsRepository(database), secretStore, {
      test: vi.fn(),
    })
    generate = vi.fn(async () => ({
      status: 'complete' as const,
      text: 'Dönüştürülmüş metin',
      inputTokens: 5,
      outputTokens: 4,
    }))
    service = new InlineAiService(notes, settings, { generate } as unknown as OpenAiResponseClient)
  })

  it('sends only a verified selection and the requested transformation instruction', async () => {
    const result = await service.run({
      noteId: 'note-inline-ai',
      requestId: '11111111-1111-4111-8111-111111111111',
      action: 'professionalize',
      selectedText: 'Seçilecek metin',
    })

    expect(result.text).toBe('Dönüştürülmüş metin')
    const request = generate.mock.calls[0]?.[0] as { input?: string; instructions?: string }
    expect(request.input).toBe(JSON.stringify({ selectedText: 'Seçilecek metin' }))
    expect(request.input).not.toContain('gönderilmeyecek bölüm')
    expect(request.instructions).toContain(inlineAiInstructionFor('professionalize'))
  })

  it('rejects text that does not belong to the saved open note', async () => {
    await expect(
      service.run({
        noteId: 'note-inline-ai',
        requestId: '22222222-2222-4222-8222-222222222222',
        action: 'correct',
        selectedText: 'Başka nottan metin',
      }),
    ).rejects.toThrow('eşleşmiyor')
    expect(generate).not.toHaveBeenCalled()
  })

  it('runs regeneration as a fresh request and supports cancellation', async () => {
    generate
      .mockResolvedValueOnce({
        status: 'complete',
        text: 'İlk sonuç',
        inputTokens: null,
        outputTokens: null,
      })
      .mockResolvedValueOnce({
        status: 'complete',
        text: 'İkinci sonuç',
        inputTokens: null,
        outputTokens: null,
      })
    const common = {
      noteId: 'note-inline-ai',
      action: 'rewrite' as const,
      selectedText: 'Seçilecek metin',
    }
    await expect(
      service.run({ ...common, requestId: '33333333-3333-4333-8333-333333333333' }),
    ).resolves.toMatchObject({ text: 'İlk sonuç' })
    await expect(
      service.run({ ...common, requestId: '44444444-4444-4444-8444-444444444444' }),
    ).resolves.toMatchObject({ text: 'İkinci sonuç' })
    expect(generate).toHaveBeenCalledTimes(2)

    generate.mockImplementationOnce(
      async (_input: unknown, signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => resolve({ status: 'cancelled' as const, message: 'İstek iptal edildi.' }),
            { once: true },
          )
        }),
    )
    const pending = service.run({
      ...common,
      requestId: '55555555-5555-4555-8555-555555555555',
    })
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(3))
    expect(service.cancel('55555555-5555-4555-8555-555555555555')).toBe(true)
    await expect(pending).rejects.toThrow('İstek iptal edildi')
  })
})
