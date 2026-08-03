import { useMemo, useState, type FormEvent } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { TAG_COLORS, type Tag } from '../../../shared/schemas/tag-schema'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'
import { useI18n } from '../i18n/i18n'

interface TagManagerDialogProps {
  readonly note: Note
  readonly tags: readonly Tag[]
  readonly onClose: () => void
  readonly onSaved: (note: Note, tags: readonly Tag[]) => void
}

export function TagManagerDialog({
  note,
  tags,
  onClose,
  onSaved,
}: TagManagerDialogProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const [availableTags, setAvailableTags] = useState<Tag[]>([...tags])
  const [selectedIds, setSelectedIds] = useState(
    () => new Set((note.tags ?? []).map((tag) => tag.id)),
  )
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState<(typeof TAG_COLORS)[number]>(TAG_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onClose, isSubmitting)
  const selectedCount = selectedIds.size
  const orderedTags = useMemo(
    () =>
      [...availableTags].sort((left, right) =>
        left.name.localeCompare(right.name, locale, { sensitivity: 'base' }),
      ),
    [availableTags, locale],
  )

  const toggleTag = (tagId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    setError(null)
  }

  const createTag = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const normalizedName = newTagName.trim().replace(/\s+/gu, ' ')
    if (!normalizedName) {
      setError(t('Etiket adı boş bırakılamaz.'))
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await window.wovenNote.organization.createTag({
        name: normalizedName,
        color: newTagColor,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setAvailableTags((current) => [...current, result.data])
      setSelectedIds((current) => new Set(current).add(result.data.id))
      setNewTagName('')
    } catch {
      setError(t('Etiket oluşturulamadı. Lütfen tekrar deneyin.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const save = async (): Promise<void> => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await window.wovenNote.organization.setNoteTags({
        noteId: note.id,
        tagIds: [...selectedIds],
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      onSaved(result.data, availableTags)
      onClose()
    } catch {
      setError(t('Etiketler kaydedilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        aria-describedby="tag-manager-description"
        aria-labelledby="tag-manager-title"
        aria-modal="true"
        className="create-note-dialog tag-manager-dialog"
        role="dialog"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <div className="dialog-heading">
          <p className="eyebrow">{t('Not organizasyonu')}</p>
          <h2 id="tag-manager-title">{t('Etiketleri yönet')}</h2>
          <p id="tag-manager-description">
            {t('“{{title}}” için birden fazla etiket seçebilirsiniz.', { title: note.title })}
          </p>
        </div>

        <fieldset className="tag-selector">
          <legend>{t('Etiketler ({{count}} seçili)', { count: selectedCount })}</legend>
          {orderedTags.length === 0 ? (
            <p className="tag-empty-state">
              {t('Henüz etiket yok. Aşağıdan ilk etiketi oluşturun.')}
            </p>
          ) : (
            <div className="tag-option-list">
              {orderedTags.map((tag) => (
                <label className="tag-option" key={tag.id}>
                  <input
                    checked={selectedIds.has(tag.id)}
                    disabled={isSubmitting}
                    onChange={() => toggleTag(tag.id)}
                    type="checkbox"
                  />
                  <span
                    aria-hidden="true"
                    className="tag-color-dot"
                    style={{ background: tag.color }}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <form className="tag-create-form" noValidate onSubmit={(event) => void createTag(event)}>
          <label htmlFor="new-tag-name">{t('Yeni etiket')}</label>
          <div className="tag-create-row">
            <input
              disabled={isSubmitting}
              id="new-tag-name"
              maxLength={40}
              onChange={(event) => {
                setNewTagName(event.target.value)
                setError(null)
              }}
              placeholder={t('Örneğin: Araştırma')}
              value={newTagName}
            />
            <label className="tag-color-label" htmlFor="new-tag-color">
              {t('Renk')}
            </label>
            <select
              aria-label={t('Etiket rengi')}
              disabled={isSubmitting}
              id="new-tag-color"
              onChange={(event) =>
                setNewTagColor(event.target.value as (typeof TAG_COLORS)[number])
              }
              value={newTagColor}
            >
              {TAG_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <button className="secondary-button" disabled={isSubmitting} type="submit">
              {t('Etiket ekle')}
            </button>
          </div>
        </form>

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
            className="primary-button"
            disabled={isSubmitting}
            onClick={() => void save()}
            type="button"
          >
            {isSubmitting ? t('Kaydediliyor…') : t('Etiketleri kaydet')}
          </button>
        </div>
      </section>
    </div>
  )
}
