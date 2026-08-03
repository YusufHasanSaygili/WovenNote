import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

import type { SaveAiSettingsInput } from '../src/shared/schemas/ai-settings-contracts'

class TestResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof window !== 'undefined') {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    })
  }

  Object.defineProperty(window, 'wovenNote', {
    configurable: true,
    value: Object.freeze({
      ai: Object.freeze({
        appendResponseToNote: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Yanıt eklenemedi.' },
        }),
        cancelInlineAction: async () => ({
          ok: true as const,
          data: { cancelled: false },
        }),
        cancelRequest: async () => ({ ok: true as const, data: { cancelled: false } }),
        copyResponse: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Yanıt kopyalanamadı.' },
        }),
        createNoteFromResponse: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Not oluşturulamadı.' },
        }),
        getThread: async (input: { id: string }) => ({
          ok: true as const,
          data: { noteId: input.id, sessionId: null, messages: [] },
        }),
        runInlineAction: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'AI işlemi kullanılamıyor.' },
        }),
        sendMessage: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
      }),
      attachments: Object.freeze({
        get: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Dosya eki bulunamadı.' },
        }),
        openExternal: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Dosya açılamadı.' },
        }),
        pickAndStore: async () => ({
          ok: true as const,
          data: { status: 'cancelled' as const },
        }),
      }),
      getRuntimeInfo: () => Object.freeze({ platform: 'win32' }),
      notes: Object.freeze({
        archive: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Not arşivlenemedi.' },
        }),
        create: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        duplicate: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        list: async () => ({ ok: true as const, data: [] }),
        listArchived: async () => ({ ok: true as const, data: [] }),
        listTrashed: async () => ({ ok: true as const, data: [] }),
        listVersions: async () => ({ ok: true as const, data: [] }),
        open: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        permanentlyDelete: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Not kalıcı olarak silinemedi.' },
        }),
        rename: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        restore: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Not geri yüklenemedi.' },
        }),
        restoreVersion: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Sürüm geri yüklenemedi.' },
        }),
        saveContent: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        search: async () => ({ ok: true as const, data: [] }),
        softDelete: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
        unarchive: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Not arşivden çıkarılamadı.' },
        }),
        updateLayouts: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Test ortamında bağlı değil.' },
        }),
      }),
      organization: Object.freeze({
        createTag: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Etiket oluşturulamadı.' },
        }),
        listTags: async () => ({ ok: true as const, data: [] }),
        setFavorite: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Favori durumu değiştirilemedi.' },
        }),
        setNoteTags: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Etiketler kaydedilemedi.' },
        }),
        setPinned: async () => ({
          ok: false as const,
          error: {
            code: 'OPERATION_FAILED' as const,
            message: 'Sabitleme durumu değiştirilemedi.',
          },
        }),
      }),
      settings: Object.freeze({
        getAiSettings: async () => ({
          ok: true as const,
          data: {
            version: 1 as const,
            model: 'gpt-5.6-terra' as const,
            maxOutputTokens: 2048,
            creativity: 'balanced' as const,
            systemInstruction: '',
            showUsage: true,
            apiKeyConfigured: false,
            apiKeyMasked: null,
            secureStorageAvailable: true,
          },
        }),
        getDetailLayout: async () => ({
          ok: true as const,
          data: { version: 1 as const, aiPanelPercentage: 30 },
        }),
        setDetailLayout: async (input: { version: 1; aiPanelPercentage: number }) => ({
          ok: true as const,
          data: input,
        }),
        saveAiSettings: async (input: SaveAiSettingsInput) => ({
          ok: true as const,
          data: {
            ...input.preferences,
            apiKeyConfigured: Boolean(input.apiKey),
            apiKeyMasked: input.apiKey ? ('••••••••••••' as const) : null,
            secureStorageAvailable: true,
          },
        }),
        testAiConnection: async () => ({
          ok: true as const,
          data: {
            status: 'failed' as const,
            code: 'MISSING_KEY' as const,
            message: 'Önce bir API anahtarı kaydedin.',
          },
        }),
      }),
    }),
  })
}

afterEach(() => {
  cleanup()
})
