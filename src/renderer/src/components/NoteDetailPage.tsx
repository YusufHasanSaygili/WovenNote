import { useEffect, useState } from 'react'
import { Group, Panel, Separator, type LayoutChangedMeta } from 'react-resizable-panels'

import type { Attachment } from '../../../shared/schemas/attachment-contracts'
import type { DetailLayout } from '../../../shared/schemas/detail-contracts'
import {
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
  type TiptapDocument,
} from '../../../shared/schemas/editor-document'
import type { Note } from '../../../shared/schemas/note-contracts'
import type { NoteExportFormat } from '../../../shared/schemas/export-contracts'
import { BasicBlockEditor } from '../editor/BasicBlockEditor'
import { useI18n } from '../i18n/i18n'
import { createAutosaveController, type AutosaveSnapshot } from '../services/autosave-controller'
import { NoteAiChatPanel } from './NoteAiChatPanel'
import { VersionHistoryDialog } from './VersionHistoryDialog'
import { ExportNoteDialog } from './ExportNoteDialog'

interface SavePayload {
  readonly document: TiptapDocument
  readonly title: string
}

interface NoteDetailPageProps {
  readonly layout: DetailLayout
  readonly note: Note
  readonly onBack: () => void
  readonly onLayoutChanged: (aiPanelPercentage: number) => void
  readonly onPickAttachment: (accept: 'image' | 'video' | 'file') => Promise<Attachment | null>
  readonly onNoteCreated: (note: Note) => void
  readonly onNoteUpdated: (note: Note) => void
  readonly onSave: (title: string, document: TiptapDocument) => Promise<void>
}

export function NoteDetailPage({
  layout,
  note,
  onBack,
  onLayoutChanged,
  onNoteCreated,
  onNoteUpdated,
  onPickAttachment,
  onSave,
}: NoteDetailPageProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const initialEnvelope = parseEditorEnvelopeJson(note.contentJson)
  const [title, setTitle] = useState(note.title)
  const [document, setDocument] = useState(() =>
    TiptapDocumentSchema.parse(initialEnvelope.content),
  )
  const [externalDocumentRevision, setExternalDocumentRevision] = useState(0)
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [autosave, setAutosave] = useState<AutosaveSnapshot>({
    error: null,
    lastSavedAt: null,
    status: 'idle',
  })
  const [autosaveController] = useState(() =>
    createAutosaveController<SavePayload>({
      onStateChange: setAutosave,
      save: (payload) => onSave(payload.title.trim(), payload.document),
    }),
  )

  useEffect(() => {
    autosaveController.setSaveHandler((payload) => onSave(payload.title.trim(), payload.document))
  }, [autosaveController, onSave])

  useEffect(() => () => autosaveController.dispose(), [autosaveController])

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void autosaveController.flush()
      }
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!autosaveController.hasPendingChanges()) return
      event.preventDefault()
      event.returnValue = ''
      void autosaveController.flush().then(() => {
        if (!autosaveController.hasPendingChanges()) globalThis.close()
      })
    }

    globalThis.addEventListener('keydown', handleSaveShortcut)
    globalThis.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      globalThis.removeEventListener('keydown', handleSaveShortcut)
      globalThis.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [autosaveController])

  const handleLayoutChanged = (
    nextLayout: Record<string, number>,
    meta: LayoutChangedMeta,
  ): void => {
    const aiPanelPercentage = nextLayout['ai-panel']
    if (meta.isUserInteraction && aiPanelPercentage !== undefined) {
      onLayoutChanged(aiPanelPercentage)
    }
  }

  const handleBack = async (): Promise<void> => {
    await autosaveController.flush()
    if (!autosaveController.hasPendingChanges()) onBack()
  }

  const flushBeforeAi = async (): Promise<void> => {
    await autosaveController.flush()
    if (autosaveController.hasPendingChanges()) {
      throw new Error(t('Not kaydedilemediği için AI isteği gönderilmedi.'))
    }
  }

  const openVersionHistory = async (): Promise<void> => {
    await autosaveController.flush()
    if (!autosaveController.hasPendingChanges()) setIsVersionHistoryOpen(true)
  }

  const openExport = async (): Promise<void> => {
    await autosaveController.flush()
    if (!autosaveController.hasPendingChanges()) setIsExportOpen(true)
  }

  const exportNote = (format: NoteExportFormat) =>
    window.wovenNote.exports.exportNote({ noteId: note.id, format })

  const handleVersionRestored = (restoredNote: Note): void => {
    const restoredEnvelope = parseEditorEnvelopeJson(restoredNote.contentJson)
    setTitle(restoredNote.title)
    setDocument(TiptapDocumentSchema.parse(restoredEnvelope.content))
    setExternalDocumentRevision((revision) => revision + 1)
    onNoteUpdated(restoredNote)
  }

  const saveStatus = {
    idle: t('Hazır'),
    dirty: t('Değişiklikler bekliyor'),
    saving: t('Kaydediliyor…'),
    saved: t('Kaydedildi'),
    error: t('Kaydetme hatası'),
  }[autosave.status]

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <button className="detail-back-button" onClick={() => void handleBack()} type="button">
          <span aria-hidden="true">←</span>
          {t('Panoya dön')}
        </button>
        <div className="detail-title-block">
          <p className="eyebrow">{t('Not detayı')}</p>
          <h1 className="sr-only">{title}</h1>
          <label className="sr-only" htmlFor="detail-note-title">
            {t('Not başlığı')}
          </label>
          <input
            id="detail-note-title"
            maxLength={200}
            onChange={(event) => {
              const nextTitle = event.target.value
              setTitle(nextTitle)
              autosaveController.schedule({ title: nextTitle, document })
            }}
            value={title}
          />
        </div>
        <div className="detail-save-area">
          <div className="autosave-status">
            <span className={`detail-status ${autosave.status}`}>{saveStatus}</span>
            {autosave.lastSavedAt ? (
              <time dateTime={autosave.lastSavedAt.toISOString()}>
                {t('Son kayıt {{time}}', {
                  time: autosave.lastSavedAt.toLocaleTimeString(locale),
                })}
              </time>
            ) : null}
          </div>
          <button
            className="secondary-button"
            disabled={autosave.status === 'saving'}
            onClick={() => void openExport()}
            type="button"
          >
            {t('Dışa aktar')}
          </button>
          <button
            className="secondary-button"
            disabled={autosave.status === 'saving'}
            onClick={() => void openVersionHistory()}
            type="button"
          >
            {t('Sürüm geçmişi')}
          </button>
          <button
            className="primary-button"
            disabled={!title.trim() || autosave.status === 'saving'}
            onClick={() => void autosaveController.flush()}
            type="button"
          >
            {t('Şimdi kaydet')}
          </button>
        </div>
      </header>

      {autosave.error ? (
        <p className="detail-save-error" role="alert">
          {autosave.error}
        </p>
      ) : null}
      <Group
        className="detail-panels"
        defaultLayout={{
          'ai-panel': layout.aiPanelPercentage,
          'editor-panel': 100 - layout.aiPanelPercentage,
        }}
        id="note-detail-panels"
        onLayoutChanged={handleLayoutChanged}
        orientation="horizontal"
      >
        <Panel id="ai-panel" minSize="20%" maxSize="45%">
          <section className="detail-panel ai-panel" aria-labelledby="ai-panel-title">
            <NoteAiChatPanel
              noteId={note.id}
              noteTitle={title}
              onNoteCreated={onNoteCreated}
              onBeforeSend={flushBeforeAi}
              onResponseAppended={(updatedNote) => {
                const updatedEnvelope = parseEditorEnvelopeJson(updatedNote.contentJson)
                setTitle(updatedNote.title)
                setDocument(TiptapDocumentSchema.parse(updatedEnvelope.content))
                setExternalDocumentRevision((revision) => revision + 1)
                onNoteUpdated(updatedNote)
              }}
            />
          </section>
        </Panel>

        <Separator
          className="panel-separator"
          id="detail-panel-separator"
          aria-label={t('Panel oranı')}
        />

        <Panel id="editor-panel" minSize="45%">
          <section className="detail-panel editor-shell" aria-labelledby="editor-shell-title">
            <div className="editor-shell-heading">
              <div>
                <p className="eyebrow">{t('Çalışma alanı')}</p>
                <h2 id="editor-shell-title">{t('Not editörü')}</h2>
              </div>
              <span>{t('Temel bloklar')}</span>
            </div>
            <BasicBlockEditor
              initialDocument={document}
              key={`editor-${externalDocumentRevision}`}
              onPickAttachment={onPickAttachment}
              onDocumentChange={(nextDocument) => {
                setDocument(nextDocument)
                autosaveController.schedule({ title, document: nextDocument })
              }}
            />
          </section>
        </Panel>
      </Group>
      {isVersionHistoryOpen ? (
        <VersionHistoryDialog
          noteId={note.id}
          onClose={() => setIsVersionHistoryOpen(false)}
          onRestored={handleVersionRestored}
        />
      ) : null}
      {isExportOpen ? (
        <ExportNoteDialog
          noteTitle={title}
          onClose={() => setIsExportOpen(false)}
          onExport={exportNote}
        />
      ) : null}
    </main>
  )
}
