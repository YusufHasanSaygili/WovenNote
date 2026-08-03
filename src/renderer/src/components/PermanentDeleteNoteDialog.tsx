import { useRef, useState } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface PermanentDeleteNoteDialogProps {
  readonly note: Note
  readonly onClose: () => void
  readonly onDeleted: (id: string) => void
}

export function PermanentDeleteNoteDialog({
  note,
  onClose,
  onDeleted,
}: PermanentDeleteNoteDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isSubmitting)

  const confirm = async (): Promise<void> => {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await window.wovenNote.notes.permanentlyDelete({
        id: note.id,
        confirmation: 'PERMANENT_DELETE',
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      onDeleted(result.data.id)
      onClose()
    } catch {
      setError(t('Not kalıcı olarak silinemedi. Lütfen tekrar deneyin.'))
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-describedby="permanent-delete-description"
        aria-labelledby="permanent-delete-title"
        aria-modal="true"
        className="create-note-dialog"
        role="alertdialog"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className="eyebrow danger-eyebrow">{t('Geri alınamaz işlem')}</p>
          <h2 id="permanent-delete-title">{t('Not kalıcı olarak silinsin mi?')}</h2>
          <p id="permanent-delete-description">
            {t(
              '“{{title}}” ve artık başka bir notun kullanmadığı dosya ekleri kalıcı olarak silinir. Bu işlem geri alınamaz.',
              { title: note.title },
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
            onClick={() => void confirm()}
            type="button"
          >
            {isSubmitting ? t('Kalıcı olarak siliniyor…') : t('Kalıcı olarak sil')}
          </button>
        </div>
      </section>
    </div>
  )
}
