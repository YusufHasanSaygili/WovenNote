import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WovenNoteApi } from '../../shared/preload-api'
import type { PickAttachmentResult } from '../../shared/schemas/attachment-contracts'
import type { Note } from '../../shared/schemas/note-contracts'
import { App } from './App'

function exampleNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-ui-001',
    title: 'Ürün fikirleri',
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
    createdAt: '2026-07-28T14:00:00.000Z',
    updatedAt: '2026-07-28T14:00:00.000Z',
    ...overrides,
  }
}

function setApi(
  overrides: Partial<WovenNoteApi['notes']>,
  attachmentOverrides: Partial<WovenNoteApi['attachments']> = {},
  settingsOverrides: Partial<WovenNoteApi['settings']> = {},
  aiOverrides: Partial<WovenNoteApi['ai']> = {},
  organizationOverrides: Partial<WovenNoteApi['organization']> = {},
  exportOverrides: Partial<WovenNoteApi['exports']> = {},
): WovenNoteApi['notes'] {
  const notes: WovenNoteApi['notes'] = {
    archive: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    create: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    duplicate: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    list: async () => ({ ok: true, data: [] }),
    listArchived: async () => ({ ok: true, data: [] }),
    listTrashed: async () => ({ ok: true, data: [] }),
    listVersions: async () => ({ ok: true, data: [] }),
    open: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    permanentlyDelete: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    rename: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    restore: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    restoreVersion: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    saveContent: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    search: async () => ({ ok: true as const, data: [] }),
    softDelete: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    unarchive: async () => ({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen test çağrısı.' },
    }),
    updateLayouts: async (input) => ({
      ok: true,
      data: { updatedIds: input.layouts.map((layout) => layout.id) },
    }),
    ...overrides,
  }

  Object.defineProperty(window, 'wovenNote', {
    configurable: true,
    value: Object.freeze({
      ai: Object.freeze({
        appendResponseToNote: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        cancelInlineAction: async () => ({
          ok: true as const,
          data: { cancelled: false },
        }),
        cancelRequest: async () => ({ ok: true as const, data: { cancelled: false } }),
        copyResponse: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        createNoteFromResponse: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        getThread: async (input: Parameters<WovenNoteApi['ai']['getThread']>[0]) => ({
          ok: true as const,
          data: { noteId: input.id, sessionId: null, messages: [] },
        }),
        runInlineAction: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        sendMessage: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'AI test ortamında bağlı değil.' },
        }),
        ...aiOverrides,
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
        ...attachmentOverrides,
      }),
      getRuntimeInfo: () => Object.freeze({ platform: 'win32' }),
      exports: Object.freeze({
        createBackup: async () => ({
          ok: true as const,
          data: { status: 'cancelled' as const },
        }),
        exportNote: async () => ({
          ok: true as const,
          data: { status: 'cancelled' as const },
        }),
        inspectBackup: async () => ({
          ok: true as const,
          data: { status: 'cancelled' as const },
        }),
        restoreBackup: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        ...exportOverrides,
      }),
      notes,
      organization: Object.freeze({
        createTag: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        listTags: async () => ({ ok: true as const, data: [] }),
        setFavorite: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        setNoteTags: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        setPinned: async () => ({
          ok: false as const,
          error: { code: 'OPERATION_FAILED' as const, message: 'Beklenmeyen test çağrısı.' },
        }),
        ...organizationOverrides,
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
        saveAiSettings: async (
          input: Parameters<WovenNoteApi['settings']['saveAiSettings']>[0],
        ) => ({
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
        ...settingsOverrides,
      }),
    }),
  })

  return notes
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '#/')
  setApi({
    create: vi.fn(async (input) => ({
      ok: true as const,
      data: exampleNote({ title: input.title }),
    })),
    list: vi.fn(async () => ({ ok: true as const, data: [] })),
  })
})

describe('App note board', () => {
  it('switches the visible interface between Turkish and English and persists the choice', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'İlk notunu oluştur' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Dil' }), {
      target: { value: 'en' },
    })

    expect(await screen.findByRole('heading', { name: 'Create your first note' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'New Note' })).toBeVisible()
    expect(screen.getByRole('searchbox', { name: 'Search notes' })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(window.localStorage.getItem('wovennote.language.v1')).toBe('en')

    fireEvent.click(screen.getByRole('button', { name: 'AI settings' }))
    expect(await screen.findByRole('heading', { name: 'AI configuration' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveDisplayValue(
      'GPT-5.6 Terra — Balanced',
    )
    expect(screen.getByRole('option', { name: 'GPT-5.6 Sol — Highest quality' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'GPT-5.6 Luna — Economical' })).toBeVisible()
    expect(screen.queryByText('GPT-5.6 Terra — Dengeli')).not.toBeInTheDocument()
  })

  it('persists light/dark/system themes and follows live system changes', async () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined
    const matches = false
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: (_type: string, nextListener: (event: MediaQueryListEvent) => void) => {
          listener = nextListener
        },
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      })),
    })
    try {
      render(<App />)
      await screen.findByRole('heading', { name: 'İlk notunu oluştur' })
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
      const theme = screen.getByRole('combobox', { name: 'Tema' })
      fireEvent.change(theme, { target: { value: 'dark' } })
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      expect(window.localStorage.getItem('wovennote.theme.v1')).toBe('dark')
      fireEvent.change(theme, { target: { value: 'system' } })
      act(() => listener?.({ matches: true } as MediaQueryListEvent))
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
      act(() => listener?.({ matches: false } as MediaQueryListEvent))
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('debounces title/content search, shows no-result state, and restores the cached list', async () => {
    const matching = exampleNote({ id: 'search-match', title: 'İstanbul ışık planı' })
    const other = exampleNote({ id: 'search-other', title: 'Ankara notu' })
    const search = vi.fn(async ({ query }: { query: string }) => ({
      ok: true as const,
      data: query === 'İÇERİK' ? [matching] : [],
    }))
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [matching, other] })),
      search,
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'İstanbul ışık planı' })
    const input = screen.getByRole('searchbox', { name: 'Notlarda ara' })
    fireEvent.change(input, { target: { value: 'İÇERİK' } })
    expect(search).not.toHaveBeenCalled()
    await waitFor(() => expect(search).toHaveBeenCalledWith({ query: 'İÇERİK' }))
    expect(screen.getByRole('heading', { name: 'İstanbul ışık planı' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Ankara notu' })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'eşleşmeyen' } })
    expect(await screen.findByRole('heading', { name: 'Aramayla eşleşen not yok' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Aramayı temizle' }))
    expect(await screen.findByRole('heading', { name: 'Ankara notu' })).toBeVisible()
    expect(input).toHaveValue('')
  })

  it('offers explicit accessible actions for a completed AI response', async () => {
    const selected = exampleNote({ id: 'note-ai-actions', title: 'Eylem notu' })
    const messageId = '33333333-3333-4333-8333-333333333333'
    const appended = exampleNote({
      ...selected,
      searchText: 'AI sonucu',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AI sonucu' }] }],
        },
      }),
    })
    const created = exampleNote({ id: 'created-ai-note', title: 'Eylem notu — AI yanıtı' })
    const copyResponse = vi.fn(async () => ({ ok: true as const, data: { copied: true as const } }))
    const appendResponseToNote = vi.fn(async () => ({ ok: true as const, data: appended }))
    const createNoteFromResponse = vi.fn(async () => ({ ok: true as const, data: created }))
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
        open: vi.fn(async () => ({ ok: true as const, data: selected })),
      },
      {},
      {
        getAiSettings: async () => ({
          ok: true as const,
          data: {
            version: 1 as const,
            model: 'gpt-5.6-terra' as const,
            maxOutputTokens: 2048,
            creativity: 'balanced' as const,
            systemInstruction: '',
            showUsage: true,
            apiKeyConfigured: true,
            apiKeyMasked: '••••••••••••' as const,
            secureStorageAvailable: true,
          },
        }),
      },
      {
        appendResponseToNote,
        copyResponse,
        createNoteFromResponse,
        getThread: async () => ({
          ok: true as const,
          data: {
            noteId: selected.id,
            sessionId: '11111111-1111-4111-8111-111111111111',
            messages: [
              {
                id: messageId,
                sessionId: '11111111-1111-4111-8111-111111111111',
                role: 'assistant' as const,
                content: 'AI sonucu',
                status: 'complete' as const,
                createdAt: '2026-07-28T22:30:00.000Z',
              },
            ],
          },
        }),
      },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Eylem notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Eylem notu notunu aç' }))
    expect(await screen.findByText('AI sonucu')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Yanıtı kopyala' }))
    expect(await screen.findByRole('status')).toHaveTextContent('panoya kopyalandı')
    expect(copyResponse).toHaveBeenCalledWith({ noteId: selected.id, messageId })

    fireEvent.click(screen.getByRole('button', { name: 'Nota ekle' }))
    await waitFor(() => expect(appendResponseToNote).toHaveBeenCalledTimes(1))
    expect(appendResponseToNote).toHaveBeenCalledWith({ noteId: selected.id, messageId })

    fireEvent.click(screen.getByRole('button', { name: 'Yeni not oluştur' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Eylem notu — AI yanıtı')
    expect(createNoteFromResponse).toHaveBeenCalledWith({ noteId: selected.id, messageId })
  })

  it('loads persisted notes through the preload API', async () => {
    setApi({
      create: vi.fn(),
      list: vi.fn(async () => ({ ok: true as const, data: [exampleNote()] })),
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Ürün fikirleri' })).toBeVisible()
    expect(screen.getByText('1 not')).toBeVisible()
  })

  it('rejects a blank title inside the modal', async () => {
    render(<App />)
    await screen.findByText('İlk notunu oluştur')

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Not' }))
    const input = screen.getByLabelText('Not başlığı')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Not başlığı boş bırakılamaz.')
  })

  it('shows a newly created note and prevents duplicate submissions', async () => {
    let resolveCreate:
      ((value: Awaited<ReturnType<WovenNoteApi['notes']['create']>>) => void) | undefined
    const create = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<WovenNoteApi['notes']['create']>>>((resolve) => {
          resolveCreate = resolve
        }),
    )
    setApi({ create, list: vi.fn(async () => ({ ok: true as const, data: [] })) })

    render(<App />)
    await screen.findByText('İlk notunu oluştur')

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Not' }))
    const input = screen.getByLabelText('Not başlığı')
    fireEvent.change(input, { target: { value: 'Tek kayıt' } })
    const form = input.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(create).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveCreate?.({ ok: true, data: exampleNote({ title: 'Tek kayıt' }) })
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tek kayıt' })).toBeVisible()
    })
    expect(screen.getAllByRole('heading', { name: 'Tek kayıt' })).toHaveLength(1)
  })

  it('does not change data when soft delete confirmation is cancelled', async () => {
    const softDelete = vi.fn()
    setApi({ list: vi.fn(async () => ({ ok: true as const, data: [exampleNote()] })), softDelete })

    render(<App />)
    await screen.findByRole('heading', { name: 'Ürün fikirleri' })

    fireEvent.click(screen.getByRole('button', { name: 'Ürün fikirleri işlemleri' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Çöp kutusuna taşı' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }))

    expect(softDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Ürün fikirleri' })).toBeVisible()
  })

  it('switches between grid and list views and restores the selection', async () => {
    setApi({ list: vi.fn(async () => ({ ok: true as const, data: [exampleNote()] })) })

    const firstRender = render(<App />)
    await screen.findByRole('heading', { name: 'Ürün fikirleri' })

    const listButton = screen.getByRole('button', { name: 'Liste görünümü' })
    expect(screen.getByRole('button', { name: 'Grid görünümü' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(listButton)

    expect(listButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Notlar')).toHaveAttribute('data-view', 'list')

    firstRender.unmount()
    render(<App />)
    await screen.findByRole('heading', { name: 'Ürün fikirleri' })
    expect(screen.getByRole('button', { name: 'Liste görünümü' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('collapses the sidebar through its keyboard-accessible button and persists it', async () => {
    const firstRender = render(<App />)
    await screen.findByText('İlk notunu oluştur')

    const collapseButton = screen.getByRole('button', { name: 'Menüyü daralt' })
    collapseButton.focus()
    fireEvent.keyDown(collapseButton, { key: 'Enter' })
    fireEvent.click(collapseButton)

    expect(screen.getByRole('button', { name: 'Menüyü genişlet' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    firstRender.unmount()
    render(<App />)
    await screen.findByText('İlk notunu oluştur')
    expect(screen.getByRole('button', { name: 'Menüyü genişlet' })).toBeVisible()
  })

  it('opens the selected note detail and returns without losing board preferences', async () => {
    const selected = exampleNote({ id: 'selected-note', title: 'Doğru not' })
    const other = exampleNote({ id: 'other-note', title: 'Diğer not' })
    const open = vi.fn(async ({ id }: { id: string }) => ({
      ok: true as const,
      data: id === selected.id ? selected : other,
    }))
    setApi({ list: vi.fn(async () => ({ ok: true as const, data: [selected, other] })), open })

    render(<App />)
    await screen.findByRole('heading', { name: 'Doğru not' })
    fireEvent.click(screen.getByRole('button', { name: 'Liste görünümü' }))
    fireEvent.click(screen.getByRole('button', { name: 'Doğru not notunu aç' }))

    expect(await screen.findByText('AI henüz yapılandırılmadı')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Doğru not' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Not editörü' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Şimdi kaydet' })).toBeEnabled()
    expect(open).toHaveBeenCalledWith({ id: selected.id })

    fireEvent.click(screen.getByRole('button', { name: 'Panoya dön' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Liste görünümü' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  it('keeps editor content visible when an immediate autosave fails', async () => {
    const note = exampleNote({
      title: 'Korunan not',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Kayıp olmaması gereken içerik' }],
            },
          ],
        },
      }),
    })
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [note] })),
      open: vi.fn(async () => ({ ok: true as const, data: note })),
      saveContent: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'OPERATION_FAILED' as const, message: 'Disk yazma hatası.' },
      })),
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Korunan not' })
    fireEvent.click(screen.getByRole('button', { name: 'Korunan not notunu aç' }))
    expect(await screen.findByText('Kayıp olmaması gereken içerik')).toBeVisible()

    fireEvent.change(screen.getByRole('textbox', { name: 'Not başlığı' }), {
      target: { value: 'Korunan not güncel' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Şimdi kaydet' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Disk yazma hatası.')
    expect(screen.getByText('Kayıp olmaması gereken içerik')).toBeVisible()
  })

  it('exports the opened note through the path-free preload contract', async () => {
    const note = exampleNote({ title: 'Dışa aktarılacak not' })
    const exportNote = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'saved' as const,
        format: 'markdown' as const,
        fileName: 'not.md',
        bytesWritten: 24,
      },
    }))
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [note] })),
        open: vi.fn(async () => ({ ok: true as const, data: note })),
      },
      {},
      {},
      {},
      {},
      { exportNote },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Dışa aktarılacak not' })
    fireEvent.click(screen.getByRole('button', { name: 'Dışa aktarılacak not notunu aç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Dışa aktar' }))
    expect(await screen.findByRole('dialog', { name: 'Notu dışa aktar' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Markdown/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('not.md başarıyla kaydedildi.')
    expect(exportNote).toHaveBeenCalledWith({ noteId: note.id, format: 'markdown' })
  })

  it('finds and cycles through matches with the in-note search', async () => {
    const note = exampleNote({
      title: 'Aranabilir not',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'İçerik başlangıcı ve ikinci İÇERİK' }],
            },
          ],
        },
      }),
    })
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [note] })),
      open: vi.fn(async () => ({ ok: true as const, data: note })),
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Aranabilir not' })
    fireEvent.click(screen.getByRole('button', { name: 'Aranabilir not notunu aç' }))
    await screen.findByText(/İçerik başlangıcı/)

    fireEvent.keyDown(window, { ctrlKey: true, key: 'f' })
    const searchInput = await screen.findByRole('searchbox', { name: 'Not içinde ara' })
    fireEvent.change(searchInput, { target: { value: 'içerik' } })
    expect(screen.getByText('1 / 2')).toBeVisible()

    fireEvent.keyDown(searchInput, { key: 'Enter' })
    expect(screen.getByText('2 / 2')).toBeVisible()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.queryByRole('search', { name: 'Not içinde ara' })).not.toBeInTheDocument()
  })

  it('stores and inserts a selected JPEG image through the path-free preload contract', async () => {
    const selected = exampleNote({ title: 'Dosyalı not' })
    const pickResult: PickAttachmentResult = {
      ok: true,
      data: {
        status: 'stored',
        attachment: {
          id: 'attachment-ui-001',
          noteId: selected.id,
          blockId: null,
          originalFileName: 'görsel.jpg',
          mimeType: 'image/jpeg',
          fileSize: 512,
          width: null,
          height: null,
          createdAt: '2026-07-28T18:30:00.000Z',
        },
      },
    }
    const pickAndStore = vi.fn(async () => pickResult)
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
        open: vi.fn(async () => ({ ok: true as const, data: selected })),
      },
      { pickAndStore },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Dosyalı not' })
    fireEvent.click(screen.getByRole('button', { name: 'Dosyalı not notunu aç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resim ekle' }))

    await waitFor(() => {
      expect(document.querySelector('[data-attachment-id="attachment-ui-001"]')).not.toBeNull()
    })
    expect(pickAndStore).toHaveBeenCalledWith({ noteId: selected.id, accept: 'image' })

    fireEvent.click(await screen.findByRole('button', { name: 'Görseli büyüt' }))
    await waitFor(() => {
      expect(document.querySelector('[data-attachment-id="attachment-ui-001"]')).toHaveClass(
        'width-75',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Görseli sağa hizala' }))
    await waitFor(() => {
      expect(document.querySelector('[data-attachment-id="attachment-ui-001"]')).toHaveClass(
        'alignment-right',
      )
    })
    fireEvent.change(screen.getByLabelText('Alt metin'), { target: { value: 'Grafik özeti' } })
    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Grafik özeti' })).toBeVisible()
    })
  })

  it('shows a stable placeholder when a stored image cannot be loaded', async () => {
    const selected = exampleNote({
      title: 'Bozuk görsel notu',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            {
              type: 'attachmentImage',
              attrs: {
                attachmentId: 'missing-attachment',
                alt: 'Eksik görsel',
                alignment: 'center',
                width: 50,
              },
            },
          ],
        },
      }),
    })
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
      open: vi.fn(async () => ({ ok: true as const, data: selected })),
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Bozuk görsel notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Bozuk görsel notu notunu aç' }))
    const image = await screen.findByRole('img', { name: 'Eksik görsel' })
    fireEvent.error(image)

    expect(await screen.findByText('Görsel yüklenemedi')).toBeVisible()
  })

  it('keeps an image returned through the PDF and general-file button out of the editor', async () => {
    const selected = exampleNote({ title: 'JPG dosya yolu' })
    const pickAndStore = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'stored' as const,
        attachment: {
          id: 'attachment-jpg-file-001',
          noteId: selected.id,
          blockId: null,
          originalFileName: 'fotoğraf.JPG',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          width: null,
          height: null,
          createdAt: '2026-08-03T04:20:00.000Z',
        },
      },
    }))
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
        open: vi.fn(async () => ({ ok: true as const, data: selected })),
      },
      { pickAndStore },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'JPG dosya yolu' })
    fireEvent.click(screen.getByRole('button', { name: 'JPG dosya yolu notunu aç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'PDF veya dosya ekle' }))

    expect(await screen.findByText('Seçilen dosya bu medya komutuyla uyumlu değil.')).toBeVisible()
    expect(document.querySelector('[data-attachment-id="attachment-jpg-file-001"]')).toBeNull()
    expect(pickAndStore).toHaveBeenCalledWith({ noteId: selected.id, accept: 'file' })
  })

  it('turns a supported YouTube link into a sandboxed playable video block', async () => {
    const selected = exampleNote({ title: 'YouTube notu' })
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
      open: vi.fn(async () => ({ ok: true as const, data: selected })),
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'YouTube notu' })
    fireEvent.click(screen.getByRole('button', { name: 'YouTube notu notunu aç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bağlantı ekle' }))
    fireEvent.change(screen.getByLabelText('Bağlantı adresi'), {
      target: { value: 'https://youtu.be/M7lc1UVf-VE?t=30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }))

    const frame = await screen.findByTitle('YouTube videosu')
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1&rel=0&origin=https%3A%2F%2Fwovennote.local',
    )
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
    const youtubeBlock = document.querySelector('[data-youtube-video-id="M7lc1UVf-VE"]')
    expect(youtubeBlock).toHaveClass('alignment-center')
    fireEvent.click(screen.getByRole('button', { name: 'Videoyu sağa hizala' }))
    await waitFor(() => expect(youtubeBlock).toHaveClass('alignment-right'))
  })

  it('inserts a controlled local video and opens a file card only by attachment id', async () => {
    const selected = exampleNote({ title: 'Medya notu' })
    const videoAttachment = {
      id: 'video-ui-001',
      noteId: selected.id,
      blockId: null,
      originalFileName: 'tanıtım.mp4',
      mimeType: 'video/mp4',
      fileSize: 2048,
      width: null,
      height: null,
      createdAt: '2026-07-28T19:10:00.000Z',
    }
    const fileAttachment = {
      ...videoAttachment,
      id: 'file-ui-001',
      originalFileName: 'rapor.pdf',
      mimeType: 'application/pdf',
      fileSize: 4096,
    }
    const pickAndStore = vi.fn(async (input: { accept?: string }) => ({
      ok: true as const,
      data: {
        status: 'stored' as const,
        attachment: input.accept === 'video' ? videoAttachment : fileAttachment,
      },
    }))
    const get = vi.fn(async () => ({ ok: true as const, data: fileAttachment }))
    const openExternal = vi.fn(async () => ({
      ok: true as const,
      data: { opened: true as const },
    }))
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
        open: vi.fn(async () => ({ ok: true as const, data: selected })),
      },
      { get, openExternal, pickAndStore },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Medya notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Medya notu notunu aç' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Video ekle' }))
    const video = await screen.findByLabelText('Yerel video')
    expect(video).toHaveAttribute('controls')
    expect(video).not.toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('src', 'wovennote-attachment://media/video-ui-001')
    const localVideoBlock = document.querySelector('[data-attachment-id="video-ui-001"]')
    expect(localVideoBlock).toHaveClass('alignment-center')
    fireEvent.click(screen.getByRole('button', { name: 'Videoyu sola hizala' }))
    await waitFor(() => expect(localVideoBlock).toHaveClass('alignment-left'))

    fireEvent.click(screen.getByRole('button', { name: 'PDF veya dosya ekle' }))
    expect(await screen.findByText('rapor.pdf')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Dış uygulamada aç' }))

    await waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith({ attachmentId: 'file-ui-001' })
    })
    expect(get).toHaveBeenCalledWith({ attachmentId: 'file-ui-001' })
  })

  it('shows understandable missing states for video and general file blocks', async () => {
    const selected = exampleNote({
      title: 'Eksik medya notu',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [
            { type: 'attachmentVideo', attrs: { attachmentId: 'missing-video' } },
            { type: 'attachmentFile', attrs: { attachmentId: 'missing-file' } },
          ],
        },
      }),
    })
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
      open: vi.fn(async () => ({ ok: true as const, data: selected })),
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Eksik medya notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Eksik medya notu notunu aç' }))
    fireEvent.error(await screen.findByLabelText('Yerel video'))

    expect(await screen.findByText('Video yüklenemedi')).toBeVisible()
    expect(await screen.findByText('Dosya eki bulunamadı')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dış uygulamada aç' })).toBeDisabled()
  })

  it('saves AI preferences without retaining the real key and maps a failed connection', async () => {
    const saveAiSettings = vi.fn(
      async (input: Parameters<WovenNoteApi['settings']['saveAiSettings']>[0]) => ({
        ok: true as const,
        data: {
          ...input.preferences,
          apiKeyConfigured: true,
          apiKeyMasked: '••••••••••••' as const,
          secureStorageAvailable: true,
        },
      }),
    )
    const testAiConnection = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'failed' as const,
        code: 'INVALID_KEY' as const,
        message: 'API anahtarı geçersiz veya bu modele erişemiyor.',
      },
    }))
    setApi(
      { list: vi.fn(async () => ({ ok: true as const, data: [] })) },
      {},
      { saveAiSettings, testAiConnection },
    )

    render(<App />)
    await screen.findByText('İlk notunu oluştur')
    fireEvent.click(screen.getByRole('button', { name: 'AI ayarları' }))
    expect(await screen.findByRole('heading', { name: 'AI yapılandırması' })).toBeVisible()

    const apiKeyInput = screen.getByLabelText('Yeni API anahtarı')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-renderer-transient-secret-value' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-5.6-luna' } })
    fireEvent.change(screen.getByLabelText('Maksimum yanıt uzunluğu'), {
      target: { value: '4096' },
    })
    fireEvent.change(screen.getByLabelText('Yaratıcılık düzeyi'), {
      target: { value: 'creative' },
    })
    fireEvent.change(screen.getByLabelText('İsteğe bağlı sistem talimatı'), {
      target: { value: 'Kısa yanıtla.' },
    })
    fireEvent.click(screen.getByLabelText('Kullanım bilgisini AI yanıtlarında göster'))
    fireEvent.click(screen.getByRole('button', { name: 'AI ayarlarını kaydet' }))

    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith({
        preferences: {
          version: 1,
          model: 'gpt-5.6-luna',
          maxOutputTokens: 4096,
          creativity: 'creative',
          systemInstruction: 'Kısa yanıtla.',
          showUsage: false,
        },
        apiKey: 'sk-renderer-transient-secret-value',
        removeApiKey: false,
      })
    })
    expect(apiKeyInput).toHaveValue('')
    expect(document.body).not.toHaveTextContent('sk-renderer-transient-secret-value')
    expect(screen.getByDisplayValue('••••••••••••')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Bağlantıyı test et' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('API anahtarı geçersiz')
    expect(testAiConnection).toHaveBeenCalledTimes(1)
  })

  it('flushes the open note before sending a note-scoped AI message and supports cancellation', async () => {
    const selected = exampleNote({ id: 'note-chat-ui', title: 'Sohbet notu' })
    const saveContent = vi.fn(async (input) => ({
      ok: true as const,
      data: { ...selected, title: input.title },
    }))
    let resolveSend:
      ((value: Awaited<ReturnType<WovenNoteApi['ai']['sendMessage']>>) => void) | undefined
    const sendMessage = vi.fn<WovenNoteApi['ai']['sendMessage']>(
      () =>
        new Promise<Awaited<ReturnType<WovenNoteApi['ai']['sendMessage']>>>((resolve) => {
          resolveSend = resolve
        }),
    )
    const cancelRequest = vi.fn(async () => ({
      ok: true as const,
      data: { cancelled: true },
    }))
    setApi(
      {
        list: vi.fn(async () => ({ ok: true as const, data: [selected] })),
        open: vi.fn(async () => ({ ok: true as const, data: selected })),
        saveContent,
      },
      {},
      {
        getAiSettings: async () => ({
          ok: true as const,
          data: {
            version: 1 as const,
            model: 'gpt-5.6-terra' as const,
            maxOutputTokens: 2048,
            creativity: 'balanced' as const,
            systemInstruction: '',
            showUsage: true,
            apiKeyConfigured: true,
            apiKeyMasked: '••••••••••••' as const,
            secureStorageAvailable: true,
          },
        }),
      },
      {
        cancelRequest,
        getThread: async () => ({
          ok: true as const,
          data: { noteId: selected.id, sessionId: null, messages: [] },
        }),
        sendMessage,
      },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Sohbet notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Sohbet notu notunu aç' }))
    expect(await screen.findByRole('heading', { name: 'AI ile konuş' })).toBeVisible()

    fireEvent.change(screen.getByLabelText('Not başlığı'), {
      target: { value: 'Güncel sohbet notu' },
    })
    fireEvent.change(screen.getByLabelText("AI'a sor"), { target: { value: 'Bu notu özetle.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByText('Yanıt hazırlanıyor…')).toBeVisible()
    await waitFor(() => expect(saveContent).toHaveBeenCalledTimes(1))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    const saveOrder = saveContent.mock.invocationCallOrder[0]
    const sendOrder = sendMessage.mock.invocationCallOrder[0]
    const sentInput = sendMessage.mock.calls[0]?.[0]
    if (saveOrder === undefined || sendOrder === undefined || !sentInput) {
      throw new Error('Expected save and AI send calls were not recorded.')
    }
    expect(saveOrder).toBeLessThan(sendOrder)
    expect(sentInput).toMatchObject({
      noteId: selected.id,
      message: 'Bu notu özetle.',
    })
    expect(sentInput).not.toHaveProperty('noteContent')

    fireEvent.click(screen.getByRole('button', { name: 'İsteği iptal et' }))
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledTimes(1))
    expect(cancelRequest).toHaveBeenCalledWith({ requestId: sentInput.requestId })

    await act(async () => {
      resolveSend?.({
        ok: true,
        data: {
          contextTruncated: false,
          thread: {
            noteId: selected.id,
            sessionId: '11111111-1111-4111-8111-111111111111',
            messages: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                sessionId: '11111111-1111-4111-8111-111111111111',
                role: 'user',
                content: 'Bu notu özetle.',
                status: 'complete',
                createdAt: '2026-07-28T21:00:00.000Z',
              },
              {
                id: '33333333-3333-4333-8333-333333333333',
                sessionId: '11111111-1111-4111-8111-111111111111',
                role: 'assistant',
                content: 'İstek iptal edildi.',
                status: 'cancelled',
                createdAt: '2026-07-28T21:00:01.000Z',
              },
            ],
          },
        },
      })
    })
    expect(await screen.findByText('İstek iptal edildi.')).toBeVisible()
  })

  it('filters pinned and favorite notes and updates card status through the organization API', async () => {
    const pinned = exampleNote({ id: 'pinned-note', title: 'Sabit not', isPinned: true })
    const favorite = exampleNote({ id: 'favorite-note', title: 'Favori not', isFavorite: true })
    const setPinned = vi.fn(async () => ({
      ok: true as const,
      data: { ...pinned, isPinned: false },
    }))
    const setFavorite = vi.fn(async () => ({
      ok: true as const,
      data: { ...pinned, isFavorite: true },
    }))
    setApi(
      { list: vi.fn(async () => ({ ok: true as const, data: [pinned, favorite] })) },
      {},
      {},
      {},
      { setFavorite, setPinned },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Sabit not' })
    fireEvent.click(screen.getByRole('button', { name: 'Sabitlenenler' }))
    expect(screen.getByRole('heading', { name: 'Sabit not' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Favori not' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Favoriler' }))
    expect(screen.getByRole('heading', { name: 'Favori not' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Tüm notlar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Sabit not işlemleri' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sabitlemeyi kaldır' }))
    await waitFor(() => expect(setPinned).toHaveBeenCalledWith({ id: pinned.id, value: false }))
    expect(await screen.findByRole('status')).toHaveTextContent('Notun sabitlemesi kaldırıldı.')

    fireEvent.click(screen.getByRole('button', { name: 'Sabit not işlemleri' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Favoriye ekle' }))
    await waitFor(() => expect(setFavorite).toHaveBeenCalledWith({ id: pinned.id, value: true }))
  })

  it('creates, selects and persists multiple tags from a card', async () => {
    const note = exampleNote({ id: 'tag-note', title: 'Etiketli not', tags: [] })
    const existingTag = {
      id: 'tag-existing',
      name: 'Araştırma',
      color: '#5364d8' as const,
      createdAt: '2026-07-28T16:00:00.000Z',
    }
    const createdTag = {
      id: 'tag-created',
      name: 'Acil',
      color: '#b42318' as const,
      createdAt: '2026-07-28T16:01:00.000Z',
    }
    const createTag = vi.fn(async () => ({ ok: true as const, data: createdTag }))
    const setNoteTags = vi.fn(async () => ({
      ok: true as const,
      data: { ...note, tags: [existingTag, createdTag] },
    }))
    setApi(
      { list: vi.fn(async () => ({ ok: true as const, data: [note] })) },
      {},
      {},
      {},
      {
        createTag,
        listTags: vi.fn(async () => ({ ok: true as const, data: [existingTag] })),
        setNoteTags,
      },
    )

    render(<App />)
    await screen.findByRole('heading', { name: 'Etiketli not' })
    fireEvent.click(screen.getByRole('button', { name: 'Etiketli not işlemleri' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Etiketleri yönet' }))
    expect(await screen.findByRole('dialog', { name: 'Etiketleri yönet' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Etiket ekle' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Etiket adı boş bırakılamaz.')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Araştırma' }))
    fireEvent.change(screen.getByLabelText('Yeni etiket'), { target: { value: 'Acil' } })
    fireEvent.change(screen.getByLabelText('Etiket rengi'), { target: { value: '#b42318' } })
    fireEvent.click(screen.getByRole('button', { name: 'Etiket ekle' }))
    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Acil', color: '#b42318' }))
    fireEvent.click(screen.getByRole('button', { name: 'Etiketleri kaydet' }))
    await waitFor(() =>
      expect(setNoteTags).toHaveBeenCalledWith({
        noteId: note.id,
        tagIds: expect.arrayContaining([existingTag.id, createdTag.id]),
      }),
    )
    expect(await screen.findByText('Not etiketleri güncellendi.')).toBeVisible()
    expect(screen.getByText('Araştırma')).toBeVisible()
    expect(screen.getByText('Acil')).toBeVisible()
  })

  it('archives an active note and restores it from the archive screen', async () => {
    const active = exampleNote({ id: 'archive-note', title: 'Arşiv adayı' })
    const archived = { ...active, isArchived: true }
    const archive = vi.fn(async () => ({ ok: true as const, data: archived }))
    const unarchive = vi.fn(async () => ({ ok: true as const, data: active }))
    setApi({
      archive,
      list: vi.fn(async () => ({ ok: true as const, data: [active] })),
      listArchived: vi.fn(async () => ({ ok: true as const, data: [] })),
      unarchive,
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Arşiv adayı' })
    fireEvent.click(screen.getByRole('button', { name: 'Arşiv adayı işlemleri' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arşivle' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith({ id: active.id }))
    expect(screen.queryByRole('heading', { name: 'Arşiv adayı' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Arşiv' }))
    expect(await screen.findByRole('heading', { name: 'Arşiv adayı' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Arşivden çıkar' }))
    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ id: active.id }))
    expect(await screen.findByRole('heading', { name: 'Arşiv boş' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Tüm notlara dön' }))
    expect(await screen.findByRole('heading', { name: 'Arşiv adayı' })).toBeVisible()
  })

  it('requires confirmation for permanent deletion and can restore a trashed note', async () => {
    const trashed = exampleNote({
      id: 'trash-note',
      title: 'Çöpteki not',
      deletedAt: '2026-07-28T17:00:00.000Z',
    })
    const restored = { ...trashed, deletedAt: null }
    const permanentlyDelete = vi.fn(async () => ({
      ok: true as const,
      data: {
        id: trashed.id,
        cleanedAttachmentFiles: 0,
        preservedSharedAttachments: 0,
      },
    }))
    const restore = vi.fn(async () => ({ ok: true as const, data: restored }))
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [] })),
      listTrashed: vi.fn(async () => ({ ok: true as const, data: [trashed] })),
      permanentlyDelete,
      restore,
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'İlk notunu oluştur' })
    fireEvent.click(screen.getByRole('button', { name: 'Çöp kutusu' }))
    expect(await screen.findByRole('heading', { name: 'Çöpteki not' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
    expect(
      await screen.findByRole('alertdialog', { name: 'Not kalıcı olarak silinsin mi?' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }))
    expect(permanentlyDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Geri yükle' }))
    await waitFor(() => expect(restore).toHaveBeenCalledWith({ id: trashed.id }))
    expect(await screen.findByRole('heading', { name: 'Çöp kutusu boş' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Tüm notlara dön' }))
    expect(await screen.findByRole('heading', { name: 'Çöpteki not' })).toBeVisible()
  })

  it('previews and restores a note version after explicit confirmation', async () => {
    const current = exampleNote({
      id: 'version-ui-note',
      title: 'Sürümlü arayüz notu',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Güncel içerik' }] }],
        },
      }),
    })
    const restored = {
      ...current,
      preview: 'Eski içerik',
      searchText: 'Eski içerik',
      contentJson: JSON.stringify({
        documentVersion: 1,
        editor: 'tiptap',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eski içerik' }] }],
        },
      }),
    }
    const listVersions = vi.fn(async () => ({
      ok: true as const,
      data: [
        {
          id: 'version-ui-001',
          noteId: current.id,
          document: {
            documentVersion: 1 as const,
            editor: 'tiptap' as const,
            content: {
              type: 'doc' as const,
              content: [
                {
                  type: 'paragraph' as const,
                  content: [{ type: 'text' as const, text: 'Eski içerik' }],
                },
              ],
            },
          },
          preview: 'Eski içerik',
          reason: 'autosave' as const,
          createdAt: '2026-07-28T18:00:00.000Z',
        },
      ],
    }))
    const restoreVersion = vi.fn(async () => ({ ok: true as const, data: restored }))
    setApi({
      list: vi.fn(async () => ({ ok: true as const, data: [current] })),
      listVersions,
      open: vi.fn(async () => ({ ok: true as const, data: current })),
      restoreVersion,
    })

    render(<App />)
    await screen.findByRole('heading', { name: 'Sürümlü arayüz notu' })
    fireEvent.click(screen.getByRole('button', { name: 'Sürümlü arayüz notu notunu aç' }))
    expect(await screen.findByText('Güncel içerik')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Sürüm geçmişi' }))
    expect(await screen.findByRole('dialog', { name: 'Sürüm geçmişi' })).toBeVisible()
    expect(await screen.findByRole('region', { name: 'Sürüm önizlemesi' })).toHaveTextContent(
      'Eski içerik',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bu sürüme geri dön' }))
    expect(
      await screen.findByRole('alertdialog', { name: 'Bu sürüme geri dönülsün mü?' }),
    ).toBeVisible()
    expect(restoreVersion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Geri yüklemeyi onayla' }))
    await waitFor(() =>
      expect(restoreVersion).toHaveBeenCalledWith({
        noteId: current.id,
        versionId: 'version-ui-001',
        confirmation: 'RESTORE_VERSION',
      }),
    )
    expect(await screen.findByText('Eski içerik')).toBeVisible()
  })
})
