import { useRef, useState, type FormEvent } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface RenameNoteDialogProps {
  readonly note: Note
  readonly onClose: () => void
  readonly onRenamed: (note: Note) => void
}

export function RenameNoteDialog({
  note,
  onClose,
  onRenamed,
}: RenameNoteDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [title, setTitle] = useState(note.title)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isSubmitting)

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (submittingRef.current) return

    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setError(t('Not başlığı boş bırakılamaz.'))
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await window.wovenNote.notes.rename({ id: note.id, title: normalizedTitle })
      if (!result.ok) {
        setError(result.error.message)
        return
      }

      onRenamed(result.data)
      onClose()
    } catch {
      setError(t('Not yeniden adlandırılamadı. Lütfen tekrar deneyin.'))
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="create-note-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className="eyebrow">{t('Not işlemi')}</p>
          <h2 id="rename-title">{t('Notu yeniden adlandır')}</h2>
          <p>{t('Yeni başlık kaydedildiğinde panodaki kart hemen güncellenir.')}</p>
        </div>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor="renamed-note-title">{t('Not başlığı')}</label>
          <input
            autoFocus
            id="renamed-note-title"
            maxLength={200}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError(null)
            }}
            value={title}
          />
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
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? t('Kaydediliyor…') : t('Kaydet')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
