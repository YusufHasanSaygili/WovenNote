import { useRef, useState, type FormEvent } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface CreateNoteDialogProps {
  readonly onClose: () => void
  readonly onCreated: (note: Note) => void
}

export function CreateNoteDialog({ onClose, onCreated }: CreateNoteDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isSubmitting)

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (submittingRef.current) {
      return
    }

    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setError(t('Not başlığı boş bırakılamaz.'))
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await window.wovenNote.notes.create({ title: normalizedTitle })

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      onCreated(result.data)
      onClose()
    } catch {
      setError(t('Not oluşturulamadı. Lütfen tekrar deneyin.'))
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
        aria-labelledby="create-note-title"
        aria-describedby="create-note-description"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className="eyebrow">{t('Yeni çalışma alanı')}</p>
          <h2 id="create-note-title">{t('Yeni not oluştur')}</h2>
          <p id="create-note-description">
            {t('Notunu panoda bulabilmek için kısa bir başlık ver.')}
          </p>
        </div>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor="note-title">{t('Not başlığı')}</label>
          <input
            autoFocus
            id="note-title"
            maxLength={200}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('Örneğin: Ürün fikirleri')}
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
              {isSubmitting ? t('Oluşturuluyor…') : t('Notu oluştur')}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
