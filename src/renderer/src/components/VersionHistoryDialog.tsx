import { useEffect, useMemo, useState } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import type { NoteVersion } from '../../../shared/schemas/note-version-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface VersionHistoryDialogProps {
  readonly noteId: string
  readonly onClose: () => void
  readonly onRestored: (note: Note) => void
}

export function VersionHistoryDialog({
  noteId,
  onClose,
  onRestored,
}: VersionHistoryDialogProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isRestoring)
  const selected = versions.find((version) => version.id === selectedId) ?? null

  useEffect(() => {
    let cancelled = false
    void window.wovenNote.notes
      .listVersions({ noteId })
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setError(result.error.message)
          return
        }
        setVersions(result.data)
        setSelectedId(result.data[0]?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setError(t('Sürüm geçmişi yüklenemedi. Lütfen tekrar deneyin.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [noteId, t])

  useEffect(() => {
    const frame = globalThis.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')
        ?.focus()
    })
    return () => globalThis.cancelAnimationFrame(frame)
  }, [dialogRef, isConfirming])

  const restore = async (): Promise<void> => {
    if (!selected) return
    setIsRestoring(true)
    setError(null)
    try {
      const result = await window.wovenNote.notes.restoreVersion({
        noteId,
        versionId: selected.id,
        confirmation: 'RESTORE_VERSION',
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      onRestored(result.data)
      onClose()
    } catch {
      setError(t('Not sürümü geri yüklenemedi. Lütfen tekrar deneyin.'))
    } finally {
      setIsRestoring(false)
      setIsConfirming(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="version-history-title"
        aria-modal="true"
        className="version-history-dialog"
        role={isConfirming ? 'alertdialog' : 'dialog'}
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className={`eyebrow ${isConfirming ? 'danger-eyebrow' : ''}`}>
            {isConfirming ? t('Geri yükleme onayı') : t('Not geçmişi')}
          </p>
          <h2 id="version-history-title">
            {isConfirming ? t('Bu sürüme geri dönülsün mü?') : t('Sürüm geçmişi')}
          </h2>
          <p>
            {isConfirming
              ? t('Mevcut içerik önce geri alınabilir bir checkpoint olarak korunacak.')
              : t('Bir checkpoint seçerek içeriğini önizleyin.')}
          </p>
        </div>

        {isConfirming && selected ? (
          <>
            <div className="version-confirm-preview">
              <strong>{dateFormatter.format(new Date(selected.createdAt))}</strong>
              <p>{selected.preview || t('Bu sürüm boş bir belge içeriyor.')}</p>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                disabled={isRestoring}
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                {t('Vazgeç')}
              </button>
              <button
                className="danger-button"
                disabled={isRestoring}
                onClick={() => void restore()}
                type="button"
              >
                {isRestoring ? t('Geri yükleniyor…') : t('Geri yüklemeyi onayla')}
              </button>
            </div>
          </>
        ) : (
          <>
            {isLoading ? <p className="state-panel">{t('Sürümler yükleniyor…')}</p> : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            {!isLoading && !error && versions.length === 0 ? (
              <div className="state-panel empty-state">
                <h3>{t('Henüz checkpoint yok')}</h3>
                <p>{t('Anlamlı içerik değişikliklerinden sonra sürümler burada görünür.')}</p>
              </div>
            ) : null}
            {versions.length > 0 ? (
              <div className="version-history-content">
                <div className="version-list" role="list" aria-label={t('Sürümler')}>
                  {versions.map((version) => (
                    <button
                      aria-pressed={selectedId === version.id}
                      key={version.id}
                      onClick={() => setSelectedId(version.id)}
                      role="listitem"
                      type="button"
                    >
                      <strong>{dateFormatter.format(new Date(version.createdAt))}</strong>
                      <span>
                        {version.reason === 'restore'
                          ? t('Geri yükleme öncesi')
                          : t('Otomatik checkpoint')}
                      </span>
                    </button>
                  ))}
                </div>
                <section className="version-preview" aria-label={t('Sürüm önizlemesi')}>
                  <h3>{t('İçerik önizlemesi')}</h3>
                  <pre>{selected?.preview || t('Bu sürüm boş bir belge içeriyor.')}</pre>
                </section>
              </div>
            ) : null}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={onClose} type="button">
                {t('Kapat')}
              </button>
              <button
                className="primary-button"
                disabled={!selected}
                onClick={() => setIsConfirming(true)}
                type="button"
              >
                {t('Bu sürüme geri dön')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
