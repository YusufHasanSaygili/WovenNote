import { useState } from 'react'

import type { ExportNoteResult, NoteExportFormat } from '../../../shared/schemas/export-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface ExportNoteDialogProps {
  readonly noteTitle: string
  readonly onClose: () => void
  readonly onExport: (format: NoteExportFormat) => Promise<ExportNoteResult>
}

interface Feedback {
  readonly kind: 'success' | 'info' | 'error'
  readonly message: string
}

const formatLabels: Record<NoteExportFormat, string> = {
  markdown: 'Markdown (.md)',
  txt: 'Düz metin (.txt)',
  json: 'WovenNote JSON (.json)',
  pdf: 'PDF belgesi (.pdf)',
}

export function ExportNoteDialog({
  noteTitle,
  onClose,
  onExport,
}: ExportNoteDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [activeFormat, setActiveFormat] = useState<NoteExportFormat | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const isExporting = activeFormat !== null
  const { dialogRef, onKeyDown } = useModalFocusTrap(onClose, isExporting)

  const exportAs = async (format: NoteExportFormat): Promise<void> => {
    setActiveFormat(format)
    setFeedback(null)
    try {
      const result = await onExport(format)
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message })
      } else if (result.data.status === 'cancelled') {
        setFeedback({ kind: 'info', message: t('Dışa aktarma iptal edildi.') })
      } else {
        setFeedback({
          kind: 'success',
          message: t('{{fileName}} başarıyla kaydedildi.', { fileName: result.data.fileName }),
        })
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: t('Not dışa aktarılamadı. Hedef klasörü ve izinleri kontrol edin.'),
      })
    } finally {
      setActiveFormat(null)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="export-note-title"
        aria-modal="true"
        className="export-note-dialog"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <p className="eyebrow">{t('Tek not dışa aktarma')}</p>
          <h2 id="export-note-title">{t('Notu dışa aktar')}</h2>
          <p>{t('“{{title}}” için bir dosya biçimi seçin.', { title: noteTitle })}</p>
        </div>

        <div aria-label={t('Dışa aktarma biçimleri')} className="export-format-list" role="group">
          {(Object.keys(formatLabels) as NoteExportFormat[]).map((format) => (
            <button
              className="export-format-button"
              disabled={isExporting}
              key={format}
              onClick={() => void exportAs(format)}
              type="button"
            >
              <strong>{t(formatLabels[format])}</strong>
              <span>
                {format === 'markdown'
                  ? t('Başlıkları, listeleri ve temel metin biçimlerini korur.')
                  : format === 'txt'
                    ? t('Biçimlendirmesiz, okunabilir metin oluşturur.')
                    : format === 'json'
                      ? t('Sürümlü ve doğrulanabilir WovenNote not verisi oluşturur.')
                      : t('Sayfalara bölünmüş, yazdırılabilir bir belge oluşturur.')}
              </span>
              {activeFormat === format ? <em>{t('Kaydediliyor…')}</em> : null}
            </button>
          ))}
        </div>

        {feedback ? (
          <p
            className={`export-feedback ${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={isExporting}
            onClick={onClose}
            type="button"
          >
            {t('Kapat')}
          </button>
        </div>
      </section>
    </div>
  )
}
