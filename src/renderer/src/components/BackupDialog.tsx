import { useState } from 'react'

import type {
  BackupConflictStrategy,
  CreateBackupResult,
  InspectBackupResult,
  InspectBackupOutcome,
  RestoreBackupOutcome,
  RestoreBackupResult,
} from '../../../shared/schemas/backup-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

type ReadyBackup = Extract<InspectBackupOutcome, { status: 'ready' }>

interface BackupDialogProps {
  readonly createBackup: () => Promise<CreateBackupResult>
  readonly inspectBackup: () => Promise<InspectBackupResult>
  readonly onClose: () => void
  readonly onRestored: (outcome: RestoreBackupOutcome) => void | Promise<void>
  readonly restoreBackup: (
    importToken: string,
    strategy: BackupConflictStrategy,
  ) => Promise<RestoreBackupResult>
}

interface Feedback {
  readonly kind: 'success' | 'info' | 'error'
  readonly message: string
}

export function BackupDialog({
  createBackup,
  inspectBackup,
  onClose,
  onRestored,
  restoreBackup,
}: BackupDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [isBusy, setIsBusy] = useState(false)
  const [selected, setSelected] = useState<ReadyBackup | null>(null)
  const [strategy, setStrategy] = useState<BackupConflictStrategy>('keep-existing')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const { dialogRef, onKeyDown } = useModalFocusTrap(onClose, isBusy)

  const create = async (): Promise<void> => {
    setIsBusy(true)
    setFeedback(null)
    try {
      const result = await createBackup()
      if (!result.ok) setFeedback({ kind: 'error', message: result.error.message })
      else if (result.data.status === 'cancelled') {
        setFeedback({ kind: 'info', message: t('Yedek oluşturma iptal edildi.') })
      } else {
        setFeedback({
          kind: 'success',
          message: t('{{fileName}} kaydedildi ({{notes}} not, {{attachments}} medya).', {
            fileName: result.data.fileName,
            notes: result.data.notes,
            attachments: result.data.attachments,
          }),
        })
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: t('Tam yedek oluşturulamadı. Lütfen tekrar deneyin.'),
      })
    } finally {
      setIsBusy(false)
    }
  }

  const inspect = async (): Promise<void> => {
    setIsBusy(true)
    setFeedback(null)
    try {
      const result = await inspectBackup()
      if (!result.ok) setFeedback({ kind: 'error', message: result.error.message })
      else if (result.data.status === 'cancelled') {
        setFeedback({ kind: 'info', message: t('Yedek seçimi iptal edildi.') })
      } else {
        setSelected(result.data)
      }
    } catch {
      setFeedback({ kind: 'error', message: t('Yedek dosyası doğrulanamadı.') })
    } finally {
      setIsBusy(false)
    }
  }

  const restore = async (): Promise<void> => {
    if (!selected) return
    setIsBusy(true)
    setFeedback(null)
    try {
      const result = await restoreBackup(selected.importToken, strategy)
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message })
        return
      }
      setSelected(null)
      setFeedback({
        kind: 'success',
        message: t('{{imported}} not geri yüklendi; {{skipped}} not atlandı.', {
          imported: result.data.notesImported,
          skipped: result.data.notesSkipped,
        }),
      })
      await onRestored(result.data)
    } catch {
      setFeedback({
        kind: 'error',
        message: t('Yedek geri yüklenemedi. Yapılan değişiklikler geri alındı.'),
      })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="backup-dialog-title"
        aria-modal="true"
        className="backup-dialog"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <p className="eyebrow">{t('Yerel veri yönetimi')}</p>
          <h2 id="backup-dialog-title">{t('Yedekle ve geri yükle')}</h2>
          <p>
            {t('Notlar, etiketler, sohbetler, sürümler ve medya tek bir sürümlü pakette saklanır.')}
          </p>
        </div>

        {!selected ? (
          <div className="backup-action-grid">
            <button disabled={isBusy} onClick={() => void create()} type="button">
              <strong>{t('Tam yedek oluştur')}</strong>
              <span>{t('API anahtarı ve diğer secret değerler dahil edilmez.')}</span>
            </button>
            <button disabled={isBusy} onClick={() => void inspect()} type="button">
              <strong>{t('Yedekten geri yükle')}</strong>
              <span>{t('Dosya önce doğrulanır; hiçbir veri hemen değiştirilmez.')}</span>
            </button>
          </div>
        ) : (
          <div className="backup-restore-step">
            <div className="backup-summary" aria-label={t('Yedek özeti')}>
              <strong>{t('{{count}} not', { count: selected.summary.notes })}</strong>
              <span>{t('{{count}} medya', { count: selected.summary.attachments })}</span>
              <span>{t('{{count}} sohbet mesajı', { count: selected.summary.chatMessages })}</span>
              <span>
                {t('{{count}} kimlik çakışması', { count: selected.summary.noteConflicts })}
              </span>
            </div>
            <fieldset disabled={isBusy}>
              <legend>{t('Çakışmalarda ne yapılsın?')}</legend>
              <label>
                <input
                  checked={strategy === 'keep-existing'}
                  name="backup-conflict-strategy"
                  onChange={() => setStrategy('keep-existing')}
                  type="radio"
                />
                <span>
                  <strong>{t('Mevcut olanı koru')}</strong>
                  <small>{t('Kimliği çakışan gelen notları atlar.')}</small>
                </span>
              </label>
              <label>
                <input
                  checked={strategy === 'replace'}
                  name="backup-conflict-strategy"
                  onChange={() => setStrategy('replace')}
                  type="radio"
                />
                <span>
                  <strong>{t('Gelenle değiştir')}</strong>
                  <small>
                    {t('Çakışan mevcut notu ve ilişkili verilerini yedektekiyle değiştirir.')}
                  </small>
                </span>
              </label>
              <label>
                <input
                  checked={strategy === 'keep-both'}
                  name="backup-conflict-strategy"
                  onChange={() => setStrategy('keep-both')}
                  type="radio"
                />
                <span>
                  <strong>{t('İkisini de sakla')}</strong>
                  <small>{t('Gelen çakışan nota yeni bir kimlik verir.')}</small>
                </span>
              </label>
            </fieldset>
            <p className="backup-warning">
              {t(
                'Geri yükleme tek transaction içinde yapılır. İşlem sırasında uygulamayı kapatmayın.',
              )}
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                disabled={isBusy}
                onClick={() => setSelected(null)}
                type="button"
              >
                {t('Dosyayı değiştir')}
              </button>
              <button
                className="primary-button"
                disabled={isBusy}
                onClick={() => void restore()}
                type="button"
              >
                {isBusy ? t('Geri yükleniyor…') : t('Geri yüklemeyi başlat')}
              </button>
            </div>
          </div>
        )}

        {feedback ? (
          <p
            className={`backup-feedback ${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        ) : null}

        {!selected ? (
          <div className="dialog-actions">
            <button className="secondary-button" disabled={isBusy} onClick={onClose} type="button">
              {t('Kapat')}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
