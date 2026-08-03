import { useRef, useState } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface DeleteNoteDialogProps {
  readonly note: Note
  readonly onClose: () => void
  readonly onDeleted: (id: string) => void
}

export function DeleteNoteDialog({
  note,
  onClose,
  onDeleted,
}: DeleteNoteDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isSubmitting)

  const confirmDelete = async (): Promise<void> => {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await window.wovenNote.notes.softDelete({ id: note.id })
      if (!result.ok) {
        setError(result.error.message)
        return
      }

      onDeleted(result.data.id)
      onClose()
    } catch {
      setError(t('Not çöp kutusuna taşınamadı. Lütfen tekrar deneyin.'))
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="create-note-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className="eyebrow danger-eyebrow">{t('Kritik işlem')}</p>
          <h2 id="delete-title">{t('Not çöp kutusuna taşınsın mı?')}</h2>
          <p>
            {t(
              '“{{title}}” aktif panodan kaldırılacak. Daha sonra çöp kutusundan geri alınabilir.',
              {
                title: note.title,
              },
            )}
          </p>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            {t('İptal')}
          </button>
          <button
            className="danger-button"
            disabled={isSubmitting}
            onClick={() => void confirmDelete()}
            type="button"
          >
            {isSubmitting ? t('Taşınıyor…') : t('Çöp kutusuna taşı')}
          </button>
        </div>
      </section>
    </div>
  )
}
