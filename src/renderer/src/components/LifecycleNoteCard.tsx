import { useMemo } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useI18n } from '../i18n/i18n'

interface LifecycleNoteCardProps {
  readonly mode: 'archive' | 'trash'
  readonly note: Note
  readonly onMoveToTrash: (note: Note) => void
  readonly onPermanentlyDelete: (note: Note) => void
  readonly onRestore: (note: Note) => void
  readonly onUnarchive: (note: Note) => void
}

export function LifecycleNoteCard({
  mode,
  note,
  onMoveToTrash,
  onPermanentlyDelete,
  onRestore,
  onUnarchive,
}: LifecycleNoteCardProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )
  const timestamp = dateFormatter.format(new Date(note.deletedAt ?? note.updatedAt))

  return (
    <article className="note-card lifecycle-note-card">
      <div className="note-card-heading">
        <div>
          <p className="note-kicker">{mode === 'archive' ? t('Arşiv') : t('Çöp kutusu')}</p>
          <h2>{note.title}</h2>
        </div>
      </div>
      {(note.tags?.length ?? 0) > 0 ? (
        <div className="note-card-metadata" aria-label={t('Not etiketleri')}>
          {note.tags?.map((tag) => (
            <span
              className="note-tag"
              key={tag.id}
              style={{ '--tag-color': tag.color } as React.CSSProperties}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}
      <p className={note.preview ? 'note-preview' : 'note-preview empty-preview'}>
        {note.preview || t('Bu not henüz içerik içermiyor.')}
      </p>
      <time dateTime={mode === 'trash' && note.deletedAt ? note.deletedAt : note.updatedAt}>
        {mode === 'trash' && note.deletedAt
          ? t('Silinme {{time}}', { time: timestamp })
          : t('Son düzenleme {{time}}', { time: timestamp })}
      </time>
      <div className="lifecycle-card-actions">
        {mode === 'archive' ? (
          <>
            <button className="secondary-button" onClick={() => onUnarchive(note)} type="button">
              {t('Arşivden çıkar')}
            </button>
            <button className="secondary-button" onClick={() => onMoveToTrash(note)} type="button">
              {t('Çöp kutusuna taşı')}
            </button>
          </>
        ) : (
          <>
            <button className="secondary-button" onClick={() => onRestore(note)} type="button">
              {t('Geri yükle')}
            </button>
            <button
              className="danger-button"
              onClick={() => onPermanentlyDelete(note)}
              type="button"
            >
              {t('Kalıcı sil')}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
