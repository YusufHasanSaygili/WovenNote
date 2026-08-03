import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Layout } from 'react-grid-layout'

import type { Attachment } from '../../shared/schemas/attachment-contracts'
import { DEFAULT_DETAIL_LAYOUT, type DetailLayout } from '../../shared/schemas/detail-contracts'
import type { TiptapDocument } from '../../shared/schemas/editor-document'
import type { Note } from '../../shared/schemas/note-contracts'
import type { Tag } from '../../shared/schemas/tag-schema'
import noteGlyphUrl from './assets/note-glyph.svg'
import { CreateNoteDialog } from './components/CreateNoteDialog'
import { AiSettingsPage } from './components/AiSettingsPage'
import { DeleteNoteDialog } from './components/DeleteNoteDialog'
import { LifecycleNoteCard } from './components/LifecycleNoteCard'
import { NoteCard } from './components/NoteCard'
import { NoteDetailPage } from './components/NoteDetailPage'
import { NoteGrid } from './components/NoteGrid'
import { PermanentDeleteNoteDialog } from './components/PermanentDeleteNoteDialog'
import { RenameNoteDialog } from './components/RenameNoteDialog'
import { TagManagerDialog } from './components/TagManagerDialog'
import { BackupDialog } from './components/BackupDialog'
import { I18nProvider, useI18n, type AppLanguage } from './i18n/i18n'
import type { RestoreBackupOutcome } from '../../shared/schemas/backup-contracts'
import {
  loadBoardPreferences,
  saveBoardPreferences,
  type BoardPreferences,
} from './services/board-preferences'
import { createLayoutSaveQueue } from './services/layout-save-queue'
import { applyLayoutToNotes, layoutToUpdates } from './services/note-layout'
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ThemePreference,
} from './services/theme-preferences'

interface ToastState {
  readonly kind: 'success' | 'error'
  readonly message: string
}

type OrganizationFilter = 'all' | 'pinned' | 'favorites' | 'archive' | 'trash'

export function App(): React.JSX.Element {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}

function AppContent(): React.JSX.Element {
  const { language, setLanguage, t } = useI18n()
  const [notes, setNotes] = useState<Note[]>([])
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([])
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [renameTarget, setRenameTarget] = useState<Note | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Note | null>(null)
  const [tagTarget, setTagTarget] = useState<Note | null>(null)
  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [organizationFilter, setOrganizationFilter] = useState<OrganizationFilter>('all')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [themePreference, setThemePreference] = useState(() =>
    loadThemePreference(window.localStorage),
  )
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Note[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchRevision, setSearchRevision] = useState(0)
  const [boardPreferences, setBoardPreferences] = useState(loadBoardPreferences)
  const [openedNote, setOpenedNote] = useState<Note | null>(null)
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(
    () => globalThis.location.hash === '#/settings',
  )
  const [detailLayout, setDetailLayout] = useState<DetailLayout>(DEFAULT_DETAIL_LAYOUT)
  const openingNoteId = useRef<string | null>(null)
  const layoutSaveQueue = useMemo(
    () =>
      createLayoutSaveQueue({
        onError: (message) =>
          setToast({ kind: 'error', message: message || t('Kart düzeni kaydedilemedi.') }),
        save: (input) => window.wovenNote.notes.updateLayouts(input),
      }),
    [t],
  )

  const loadNotes = useCallback(async (): Promise<void> => {
    try {
      const [result, tagResult, archiveResult, trashResult] = await Promise.all([
        window.wovenNote.notes.list(),
        window.wovenNote.organization.listTags(),
        window.wovenNote.notes.listArchived(),
        window.wovenNote.notes.listTrashed(),
      ])

      if (!result.ok) {
        setLoadError(result.error.message)
        return
      }
      if (!tagResult.ok) {
        setLoadError(tagResult.error.message)
        return
      }
      if (!archiveResult.ok) {
        setLoadError(archiveResult.error.message)
        return
      }
      if (!trashResult.ok) {
        setLoadError(trashResult.error.message)
        return
      }

      setNotes(result.data)
      setTags(tagResult.data)
      setArchivedNotes(archiveResult.data)
      setTrashedNotes(trashResult.data)
    } catch {
      setLoadError(t('Notlar yüklenemedi. Lütfen tekrar deneyin.'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void Promise.resolve().then(loadNotes)
  }, [loadNotes])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const handleChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const resolved = resolveTheme(themePreference, systemDark)
    document.documentElement.dataset['theme'] = resolved
    document.documentElement.style.colorScheme = resolved
  }, [systemDark, themePreference])

  useEffect(() => {
    const query = searchQuery.trim()
    const timer = globalThis.setTimeout(
      () => setDebouncedSearchQuery(query),
      query.length > 0 ? 250 : 0,
    )
    return () => globalThis.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!debouncedSearchQuery) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setIsSearching(true)
      setSearchError(null)
      try {
        const result = await window.wovenNote.notes.search({ query: debouncedSearchQuery })
        if (cancelled) return
        if (!result.ok) {
          setSearchError(result.error.message)
          return
        }
        setSearchResults(result.data)
      } catch {
        if (!cancelled) setSearchError(t('Notlarda arama yapılamadı. Lütfen tekrar deneyin.'))
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [debouncedSearchQuery, searchRevision, t])

  useEffect(() => () => layoutSaveQueue.dispose(), [layoutSaveQueue])

  useEffect(() => {
    const handleHistoryNavigation = (): void => {
      const hash = globalThis.location.hash
      if (!hash.startsWith('#/notes/')) {
        setOpenedNote(null)
      }
      setIsAiSettingsOpen(hash === '#/settings')
    }

    globalThis.addEventListener('popstate', handleHistoryNavigation)
    return () => globalThis.removeEventListener('popstate', handleHistoryNavigation)
  }, [])

  const handleCreated = (note: Note): void => {
    setNotes((currentNotes) => [note, ...currentNotes.filter((item) => item.id !== note.id)])
    setSearchRevision((revision) => revision + 1)
    setAnnouncement(t('“{{title}}” oluşturuldu.', { title: note.title }))
  }

  const retryLoad = (): void => {
    setIsLoading(true)
    setLoadError(null)
    void loadNotes()
  }

  const handleBackupRestored = async (outcome: RestoreBackupOutcome): Promise<void> => {
    setIsLoading(true)
    setLoadError(null)
    await loadNotes()
    setSearchRevision((revision) => revision + 1)
    setToast({
      kind: 'success',
      message: t('{{count}} not yedekten geri yüklendi.', { count: outcome.notesImported }),
    })
  }

  const handleRenamed = (renamedNote: Note): void => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === renamedNote.id ? renamedNote : note)),
    )
    setSearchRevision((revision) => revision + 1)
    setToast({ kind: 'success', message: t('Not başlığı güncellendi.') })
  }

  const handleDuplicate = async (note: Note): Promise<void> => {
    try {
      const result = await window.wovenNote.notes.duplicate({ id: note.id })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error.message })
        return
      }

      setNotes((currentNotes) => [result.data, ...currentNotes])
      setSearchRevision((revision) => revision + 1)
      setToast({ kind: 'success', message: t('Not çoğaltıldı.') })
    } catch {
      setToast({ kind: 'error', message: t('Not çoğaltılamadı. Lütfen tekrar deneyin.') })
    }
  }

  const handleDeleted = (id: string): void => {
    const deletedNote = [...notes, ...archivedNotes].find((note) => note.id === id)
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
    setArchivedNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
    setSearchResults((currentNotes) => currentNotes.filter((note) => note.id !== id))
    if (deletedNote) {
      setTrashedNotes((currentNotes) => [
        { ...deletedNote, deletedAt: new Date().toISOString(), isArchived: false },
        ...currentNotes.filter((note) => note.id !== id),
      ])
    }
    setSearchRevision((revision) => revision + 1)
    setToast({ kind: 'success', message: t('Not çöp kutusuna taşındı.') })
  }

  const handleArchive = async (note: Note): Promise<void> => {
    try {
      const result = await window.wovenNote.notes.archive({ id: note.id })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error.message })
        return
      }
      setNotes((current) => current.filter((item) => item.id !== note.id))
      setSearchResults((current) => current.filter((item) => item.id !== note.id))
      setArchivedNotes((current) => [result.data, ...current.filter((item) => item.id !== note.id)])
      setSearchRevision((revision) => revision + 1)
      setToast({ kind: 'success', message: t('Not arşivlendi.') })
    } catch {
      setToast({ kind: 'error', message: t('Not arşivlenemedi. Lütfen tekrar deneyin.') })
    }
  }

  const handleUnarchive = async (note: Note): Promise<void> => {
    try {
      const result = await window.wovenNote.notes.unarchive({ id: note.id })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error.message })
        return
      }
      setArchivedNotes((current) => current.filter((item) => item.id !== note.id))
      setNotes((current) => [result.data, ...current.filter((item) => item.id !== note.id)])
      setToast({ kind: 'success', message: t('Not arşivden çıkarıldı.') })
    } catch {
      setToast({ kind: 'error', message: t('Not arşivden çıkarılamadı. Lütfen tekrar deneyin.') })
    }
  }

  const handleRestore = async (note: Note): Promise<void> => {
    try {
      const result = await window.wovenNote.notes.restore({ id: note.id })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error.message })
        return
      }
      setTrashedNotes((current) => current.filter((item) => item.id !== note.id))
      setNotes((current) => [result.data, ...current.filter((item) => item.id !== note.id)])
      setToast({ kind: 'success', message: t('Not geri yüklendi.') })
    } catch {
      setToast({ kind: 'error', message: t('Not geri yüklenemedi. Lütfen tekrar deneyin.') })
    }
  }

  const handlePermanentlyDeleted = (id: string): void => {
    setTrashedNotes((current) => current.filter((note) => note.id !== id))
    setToast({ kind: 'success', message: t('Not kalıcı olarak silindi.') })
  }

  const selectOrganizationFilter = (filter: OrganizationFilter): void => {
    setOrganizationFilter(filter)
    if (filter === 'archive' || filter === 'trash') {
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const replaceNote = (updatedNote: Note): void => {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note)),
    )
    setSearchResults((currentNotes) =>
      currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note)),
    )
    setSearchRevision((revision) => revision + 1)
  }

  const setNoteFlag = async (note: Note, flag: 'pinned' | 'favorite'): Promise<void> => {
    try {
      const result =
        flag === 'pinned'
          ? await window.wovenNote.organization.setPinned({ id: note.id, value: !note.isPinned })
          : await window.wovenNote.organization.setFavorite({
              id: note.id,
              value: !note.isFavorite,
            })
      if (!result.ok) {
        setToast({ kind: 'error', message: result.error.message })
        return
      }
      replaceNote(result.data)
      setToast({
        kind: 'success',
        message:
          flag === 'pinned'
            ? result.data.isPinned
              ? t('Not sabitlendi.')
              : t('Notun sabitlemesi kaldırıldı.')
            : result.data.isFavorite
              ? t('Not favorilere eklendi.')
              : t('Not favorilerden çıkarıldı.'),
      })
    } catch {
      setToast({ kind: 'error', message: t('Not durumu güncellenemedi. Lütfen tekrar deneyin.') })
    }
  }

  const handleTagsSaved = (updatedNote: Note, updatedTags: readonly Tag[]): void => {
    setTags([...updatedTags])
    replaceNote(updatedNote)
    setToast({ kind: 'success', message: t('Not etiketleri güncellendi.') })
  }

  const updateBoardPreferences = (preferences: BoardPreferences): void => {
    setBoardPreferences(preferences)
    if (!saveBoardPreferences(preferences)) {
      setToast({ kind: 'error', message: t('Görünüm tercihi kaydedilemedi.') })
    }
  }

  const toggleSidebar = (): void => {
    updateBoardPreferences({
      ...boardPreferences,
      sidebarCollapsed: !boardPreferences.sidebarCollapsed,
    })
  }

  const selectView = (view: BoardPreferences['view']): void => {
    updateBoardPreferences({ ...boardPreferences, view })
  }

  const selectTheme = (preference: ThemePreference): void => {
    setThemePreference(preference)
    if (!saveThemePreference(window.localStorage, preference)) {
      setToast({ kind: 'error', message: t('Tema tercihi kaydedilemedi.') })
    }
  }

  const handleLayoutChange = (layout: Layout): void => {
    setNotes((currentNotes) => applyLayoutToNotes(currentNotes, layout))
    layoutSaveQueue.schedule(layoutToUpdates(layout))
  }

  const handleOpenNote = async (note: Note): Promise<void> => {
    if (openingNoteId.current) return
    openingNoteId.current = note.id

    try {
      const [openedResult, layoutResult] = await Promise.all([
        window.wovenNote.notes.open({ id: note.id }),
        window.wovenNote.settings.getDetailLayout(),
      ])
      if (!openedResult.ok) {
        setToast({ kind: 'error', message: openedResult.error.message })
        return
      }

      const opened = openedResult.data
      setNotes((currentNotes) =>
        currentNotes.map((currentNote) => (currentNote.id === opened.id ? opened : currentNote)),
      )
      setDetailLayout(layoutResult.ok ? layoutResult.data : DEFAULT_DETAIL_LAYOUT)
      setOpenedNote(opened)
      globalThis.history.pushState(
        { noteId: opened.id },
        '',
        `#/notes/${encodeURIComponent(opened.id)}`,
      )
    } catch {
      setToast({ kind: 'error', message: t('Not açılamadı. Lütfen tekrar deneyin.') })
    } finally {
      openingNoteId.current = null
    }
  }

  const handleBackToBoard = (): void => {
    if (globalThis.location.hash.startsWith('#/notes/')) {
      globalThis.history.back()
      return
    }

    setOpenedNote(null)
  }

  const handleOpenAiSettings = (): void => {
    setOpenedNote(null)
    setIsAiSettingsOpen(true)
    globalThis.history.pushState({}, '', '#/settings')
  }

  const handleBackFromAiSettings = (): void => {
    if (globalThis.location.hash === '#/settings') {
      globalThis.history.back()
      return
    }
    setIsAiSettingsOpen(false)
  }

  const handleDetailLayoutChanged = (aiPanelPercentage: number): void => {
    const nextLayout: DetailLayout = { version: 1, aiPanelPercentage }
    setDetailLayout(nextLayout)
    void window.wovenNote.settings
      .setDetailLayout(nextLayout)
      .then((result) => {
        if (!result.ok) setToast({ kind: 'error', message: result.error.message })
      })
      .catch(() =>
        setToast({
          kind: 'error',
          message: t('Panel oranı kaydedilemedi. Lütfen tekrar deneyin.'),
        }),
      )
  }

  const handleSaveOpenedNote = async (title: string, document: TiptapDocument): Promise<void> => {
    if (!openedNote) throw new Error(t('Açık not bulunamadı.'))

    try {
      const result = await window.wovenNote.notes.saveContent({
        id: openedNote.id,
        title,
        document: { documentVersion: 1, editor: 'tiptap', content: document },
      })
      if (!result.ok) throw new Error(result.error.message)

      setOpenedNote(result.data)
      setNotes((currentNotes) =>
        currentNotes.map((note) => (note.id === result.data.id ? result.data : note)),
      )
      setSearchRevision((revision) => revision + 1)
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : t('Not kaydedilemedi. Lütfen tekrar deneyin.'),
        { cause: error },
      )
    }
  }

  const handleAiUpdatedNote = (note: Note): void => {
    setOpenedNote(note)
    setNotes((currentNotes) =>
      currentNotes.map((currentNote) => (currentNote.id === note.id ? note : currentNote)),
    )
    setSearchRevision((revision) => revision + 1)
  }

  const handleAiCreatedNote = (note: Note): void => {
    setNotes((currentNotes) => [note, ...currentNotes.filter((item) => item.id !== note.id)])
    setSearchRevision((revision) => revision + 1)
  }

  const handlePickAttachment = async (
    accept: 'image' | 'video' | 'file',
  ): Promise<Attachment | null> => {
    if (!openedNote) throw new Error(t('Açık not bulunamadı.'))

    try {
      const result = await window.wovenNote.attachments.pickAndStore({
        noteId: openedNote.id,
        accept,
      })
      if (!result.ok) throw new Error(result.error.message)
      return result.data.status === 'stored' ? result.data.attachment : null
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : t('Dosya eklenemedi. Lütfen tekrar deneyin.'),
        { cause: error },
      )
    }
  }

  const normalizedSearchQuery = searchQuery.trim()
  const isSearchActive = normalizedSearchQuery.length > 0
  const isLifecycleView = organizationFilter === 'archive' || organizationFilter === 'trash'
  const isSearchPending =
    isSearchActive &&
    (isSearching || normalizedSearchQuery !== debouncedSearchQuery || debouncedSearchQuery === '')
  const baseNotes =
    organizationFilter === 'archive'
      ? archivedNotes
      : organizationFilter === 'trash'
        ? trashedNotes
        : isSearchActive
          ? searchResults
          : notes
  const displayedNotes = baseNotes.filter((note) => {
    if (organizationFilter === 'pinned') return note.isPinned
    if (organizationFilter === 'favorites') return note.isFavorite
    return true
  })
  const boardTitle = isSearchActive
    ? t('Arama sonuçları')
    : organizationFilter === 'pinned'
      ? t('Sabitlenenler')
      : organizationFilter === 'favorites'
        ? t('Favoriler')
        : organizationFilter === 'archive'
          ? t('Arşiv')
          : organizationFilter === 'trash'
            ? t('Çöp kutusu')
            : t('Tüm notlar')

  const toastElement = toast ? (
    <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span>{toast.message}</span>
      <button aria-label={t('Bildirimi kapat')} onClick={() => setToast(null)} type="button">
        ×
      </button>
    </div>
  ) : null

  if (openedNote) {
    return (
      <>
        <NoteDetailPage
          layout={detailLayout}
          note={openedNote}
          onBack={handleBackToBoard}
          onLayoutChanged={handleDetailLayoutChanged}
          onNoteCreated={handleAiCreatedNote}
          onNoteUpdated={handleAiUpdatedNote}
          onPickAttachment={handlePickAttachment}
          onSave={handleSaveOpenedNote}
        />
        {toastElement}
      </>
    )
  }

  if (isAiSettingsOpen) {
    return <AiSettingsPage onBack={handleBackFromAiSettings} />
  }

  return (
    <main
      className={`app-shell ${boardPreferences.sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}
    >
      <aside className="sidebar" id="primary-sidebar" aria-label={t('Ana menü')}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <img alt="" src={noteGlyphUrl} />
          </span>
          <h1 className="sidebar-label">WovenNote</h1>
        </div>
        <nav aria-label={t('Ana gezinme')}>
          <button
            aria-label={t('Tüm notlar')}
            aria-current={organizationFilter === 'all' ? 'page' : undefined}
            aria-pressed={organizationFilter === 'all'}
            className={`sidebar-nav-item ${organizationFilter === 'all' ? 'active' : ''}`}
            onClick={() => selectOrganizationFilter('all')}
            type="button"
          >
            <span className="nav-icon" aria-hidden="true">
              ▦
            </span>
            <span className="sidebar-label">{t('Tüm notlar')}</span>
            <span className="sidebar-count sidebar-label">{notes.length}</span>
          </button>
          <button
            aria-label={t('Sabitlenenler')}
            aria-current={organizationFilter === 'pinned' ? 'page' : undefined}
            aria-pressed={organizationFilter === 'pinned'}
            className={`sidebar-nav-item ${organizationFilter === 'pinned' ? 'active' : ''}`}
            onClick={() => selectOrganizationFilter('pinned')}
            type="button"
          >
            <span className="nav-icon" aria-hidden="true">
              ⌖
            </span>
            <span className="sidebar-label">{t('Sabitlenenler')}</span>
            <span className="sidebar-count sidebar-label">
              {notes.filter((note) => note.isPinned).length}
            </span>
          </button>
          <button
            aria-label={t('Favoriler')}
            aria-current={organizationFilter === 'favorites' ? 'page' : undefined}
            aria-pressed={organizationFilter === 'favorites'}
            className={`sidebar-nav-item ${organizationFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => selectOrganizationFilter('favorites')}
            type="button"
          >
            <span className="nav-icon" aria-hidden="true">
              ★
            </span>
            <span className="sidebar-label">{t('Favoriler')}</span>
            <span className="sidebar-count sidebar-label">
              {notes.filter((note) => note.isFavorite).length}
            </span>
          </button>
          <button
            aria-label={t('Arşiv')}
            aria-current={organizationFilter === 'archive' ? 'page' : undefined}
            aria-pressed={organizationFilter === 'archive'}
            className={`sidebar-nav-item ${organizationFilter === 'archive' ? 'active' : ''}`}
            onClick={() => selectOrganizationFilter('archive')}
            type="button"
          >
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            <span className="sidebar-label">{t('Arşiv')}</span>
            <span className="sidebar-count sidebar-label">{archivedNotes.length}</span>
          </button>
          <button
            aria-label={t('Çöp kutusu')}
            aria-current={organizationFilter === 'trash' ? 'page' : undefined}
            aria-pressed={organizationFilter === 'trash'}
            className={`sidebar-nav-item ${organizationFilter === 'trash' ? 'active' : ''}`}
            onClick={() => selectOrganizationFilter('trash')}
            type="button"
          >
            <span className="nav-icon" aria-hidden="true">
              ♲
            </span>
            <span className="sidebar-label">{t('Çöp kutusu')}</span>
            <span className="sidebar-count sidebar-label">{trashedNotes.length}</span>
          </button>
          <button className="sidebar-nav-item" onClick={handleOpenAiSettings} type="button">
            <span className="nav-icon" aria-hidden="true">
              ⚙
            </span>
            <span className="sidebar-label">{t('AI ayarları')}</span>
          </button>
        </nav>
        <button
          className="sidebar-toggle"
          aria-controls="primary-sidebar"
          aria-expanded={!boardPreferences.sidebarCollapsed}
          aria-label={boardPreferences.sidebarCollapsed ? t('Menüyü genişlet') : t('Menüyü daralt')}
          onClick={toggleSidebar}
          type="button"
        >
          <span aria-hidden="true">{boardPreferences.sidebarCollapsed ? '›' : '‹'}</span>
          <span className="sidebar-label">{t('Menüyü daralt')}</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t('Yerel çalışma alanı')}</p>
            <p className="page-title">{t('Not panosu')}</p>
          </div>
          <div className="board-search">
            <label className="sr-only" htmlFor="board-search-input">
              {t('Notlarda ara')}
            </label>
            <input
              aria-controls="notes-board"
              autoComplete="off"
              disabled={isLifecycleView}
              id="board-search-input"
              maxLength={200}
              onChange={(event) => {
                const nextQuery = event.target.value
                setSearchQuery(nextQuery)
                setSearchError(null)
                setIsSearching(Boolean(nextQuery.trim()))
                if (!nextQuery.trim()) setSearchResults([])
              }}
              placeholder={
                isLifecycleView
                  ? t('Arşiv ve çöp kutusunda arama kapalı')
                  : t('Başlık, içerik ve etikette ara…')
              }
              type="search"
              value={searchQuery}
            />
            {isSearchActive ? (
              <button
                aria-label={t('Arama alanını temizle')}
                onClick={() => setSearchQuery('')}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button
              className="secondary-button backup-button"
              onClick={() => setIsBackupOpen(true)}
              type="button"
            >
              {t('Yedek')}
            </button>
            <label className="theme-control">
              <span>{t('Tema')}</span>
              <select
                aria-label={t('Tema')}
                onChange={(event) => selectTheme(event.target.value as ThemePreference)}
                value={themePreference}
              >
                <option value="system">{t('Sistem')}</option>
                <option value="light">{t('Açık')}</option>
                <option value="dark">{t('Koyu')}</option>
              </select>
            </label>
            <label className="language-control">
              <span>{t('Dil')}</span>
              <select
                aria-label={t('Dil')}
                onChange={(event) => setLanguage(event.target.value as AppLanguage)}
                value={language}
              >
                <option value="tr">{t('Türkçe')}</option>
                <option value="en">{t('İngilizce')}</option>
              </select>
            </label>
            <div className="view-toggle" role="group" aria-label={t('Not görünümü')}>
              <button
                aria-label={t('Grid görünümü')}
                aria-pressed={boardPreferences.view === 'grid'}
                onClick={() => selectView('grid')}
                type="button"
              >
                <span aria-hidden="true">▦</span>
              </button>
              <button
                aria-label={t('Liste görünümü')}
                aria-pressed={boardPreferences.view === 'list'}
                onClick={() => selectView('list')}
                type="button"
              >
                <span aria-hidden="true">☷</span>
              </button>
            </div>
            <button
              className="primary-button new-note-button"
              onClick={() => setIsCreateOpen(true)}
            >
              <span aria-hidden="true">＋</span>
              {t('Yeni Not')}
            </button>
          </div>
        </header>

        <section
          className="board"
          aria-labelledby="board-title"
          aria-busy={isLoading || isSearchPending}
          id="notes-board"
        >
          <div className="board-heading">
            <div>
              <p className="eyebrow">{t('Pano')}</p>
              <h2 id="board-title">{boardTitle}</h2>
            </div>
            {!isLoading && !loadError && !searchError ? (
              <p>{t('{{count}} not', { count: displayedNotes.length })}</p>
            ) : null}
          </div>

          {isLoading ? <p className="state-panel">{t('Notlar yükleniyor…')}</p> : null}

          {loadError ? (
            <div className="state-panel error-state" role="alert">
              <p>{loadError}</p>
              <button className="secondary-button" onClick={retryLoad}>
                {t('Tekrar dene')}
              </button>
            </div>
          ) : null}

          {isSearchPending ? (
            <p className="search-status" role="status">
              {t('Notlarda aranıyor…')}
            </p>
          ) : null}

          {searchError ? (
            <div className="state-panel error-state" role="alert">
              <p>{searchError}</p>
              <button
                className="secondary-button"
                onClick={() => setSearchRevision((revision) => revision + 1)}
                type="button"
              >
                {t('Aramayı tekrar dene')}
              </button>
            </div>
          ) : null}

          {!isLoading &&
          !loadError &&
          !isSearchActive &&
          organizationFilter === 'all' &&
          notes.length === 0 ? (
            <div className="state-panel empty-state">
              <h3>{t('İlk notunu oluştur')}</h3>
              <p>{t('Fikirlerini ve projelerini yerel olarak saklamak için yeni bir not aç.')}</p>
              <button className="secondary-button" onClick={() => setIsCreateOpen(true)}>
                {t('Yeni not oluştur')}
              </button>
            </div>
          ) : null}

          {!isLoading &&
          !loadError &&
          !isSearchActive &&
          (organizationFilter === 'pinned' || organizationFilter === 'favorites') &&
          notes.length > 0 &&
          displayedNotes.length === 0 ? (
            <div className="state-panel empty-state">
              <h3>
                {organizationFilter === 'pinned' ? t('Sabitlenmiş not yok') : t('Favori not yok')}
              </h3>
              <p>{t('Kart menüsünden bir notun durumunu değiştirebilirsiniz.')}</p>
              <button
                className="secondary-button"
                onClick={() => selectOrganizationFilter('all')}
                type="button"
              >
                {t('Tüm notlara dön')}
              </button>
            </div>
          ) : null}

          {!isLoading &&
          !loadError &&
          !isSearchActive &&
          isLifecycleView &&
          displayedNotes.length === 0 ? (
            <div className="state-panel empty-state">
              <h3>{organizationFilter === 'archive' ? t('Arşiv boş') : t('Çöp kutusu boş')}</h3>
              <p>
                {organizationFilter === 'archive'
                  ? t('Arşivlediğiniz notlar burada görünür.')
                  : t('Çöp kutusuna taşıdığınız notlar burada görünür.')}
              </p>
              <button
                className="secondary-button"
                onClick={() => selectOrganizationFilter('all')}
                type="button"
              >
                {t('Tüm notlara dön')}
              </button>
            </div>
          ) : null}

          {!isLoading &&
          !loadError &&
          !searchError &&
          isSearchActive &&
          !isSearchPending &&
          displayedNotes.length === 0 ? (
            <div className="state-panel empty-state">
              <h3>{t('Aramayla eşleşen not yok')}</h3>
              <p>{t('Başka bir başlık, içerik veya etiket ifadesi deneyin.')}</p>
              <button className="secondary-button" onClick={() => setSearchQuery('')} type="button">
                {t('Aramayı temizle')}
              </button>
            </div>
          ) : null}

          {!isLoading && !loadError && !searchError && displayedNotes.length > 0 ? (
            isLifecycleView ? (
              <div className="notes-grid lifecycle-list" aria-label={boardTitle}>
                {displayedNotes.map((note) => (
                  <LifecycleNoteCard
                    key={note.id}
                    mode={organizationFilter === 'archive' ? 'archive' : 'trash'}
                    note={note}
                    onMoveToTrash={setDeleteTarget}
                    onPermanentlyDelete={setPermanentDeleteTarget}
                    onRestore={(selectedNote) => void handleRestore(selectedNote)}
                    onUnarchive={(selectedNote) => void handleUnarchive(selectedNote)}
                  />
                ))}
              </div>
            ) : boardPreferences.view === 'grid' ? (
              <NoteGrid
                notes={displayedNotes}
                onArchive={(selectedNote) => void handleArchive(selectedNote)}
                onDelete={setDeleteTarget}
                onDuplicate={(selectedNote) => void handleDuplicate(selectedNote)}
                onLayoutChange={handleLayoutChange}
                onManageTags={setTagTarget}
                onOpen={(selectedNote) => void handleOpenNote(selectedNote)}
                onRename={setRenameTarget}
                onSetFavorite={(selectedNote) => void setNoteFlag(selectedNote, 'favorite')}
                onSetPinned={(selectedNote) => void setNoteFlag(selectedNote, 'pinned')}
              />
            ) : (
              <div className="notes-grid list-view" aria-label={t('Notlar')} data-view="list">
                {displayedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onArchive={(selectedNote) => void handleArchive(selectedNote)}
                    onDelete={setDeleteTarget}
                    onDuplicate={(selectedNote) => void handleDuplicate(selectedNote)}
                    onManageTags={setTagTarget}
                    onOpen={(selectedNote) => void handleOpenNote(selectedNote)}
                    onRename={setRenameTarget}
                    onSetFavorite={(selectedNote) => void setNoteFlag(selectedNote, 'favorite')}
                    onSetPinned={(selectedNote) => void setNoteFlag(selectedNote, 'pinned')}
                  />
                ))}
              </div>
            )
          ) : null}
        </section>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {toastElement}

      {isCreateOpen ? (
        <CreateNoteDialog onClose={() => setIsCreateOpen(false)} onCreated={handleCreated} />
      ) : null}

      {isBackupOpen ? (
        <BackupDialog
          createBackup={() => window.wovenNote.exports.createBackup()}
          inspectBackup={() => window.wovenNote.exports.inspectBackup()}
          onClose={() => setIsBackupOpen(false)}
          onRestored={handleBackupRestored}
          restoreBackup={(importToken, conflictStrategy) =>
            window.wovenNote.exports.restoreBackup({ importToken, conflictStrategy })
          }
        />
      ) : null}

      {renameTarget ? (
        <RenameNoteDialog
          note={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={handleRenamed}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteNoteDialog
          note={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      ) : null}

      {tagTarget ? (
        <TagManagerDialog
          note={tagTarget}
          onClose={() => setTagTarget(null)}
          onSaved={handleTagsSaved}
          tags={tags}
        />
      ) : null}

      {permanentDeleteTarget ? (
        <PermanentDeleteNoteDialog
          note={permanentDeleteTarget}
          onClose={() => setPermanentDeleteTarget(null)}
          onDeleted={handlePermanentlyDeleted}
        />
      ) : null}
    </main>
  )
}
