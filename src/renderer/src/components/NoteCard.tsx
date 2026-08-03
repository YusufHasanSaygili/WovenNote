import { useMemo, useState } from 'react'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useI18n } from '../i18n/i18n'

interface NoteCardProps {
  readonly note: Note
  readonly onArchive: (note: Note) => void
  readonly onDelete: (note: Note) => void
  readonly onDuplicate: (note: Note) => void
  readonly onManageTags: (note: Note) => void
  readonly onOpen: (note: Note) => void
  readonly onRename: (note: Note) => void
  readonly onSetFavorite: (note: Note) => void
  readonly onSetPinned: (note: Note) => void
  readonly showDragHandle?: boolean
}

export function NoteCard({
  note,
  onArchive,
  onDelete,
  onDuplicate,
  onManageTags,
  onOpen,
  onRename,
  onSetFavorite,
  onSetPinned,
  showDragHandle = false,
}: NoteCardProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const updatedAtFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )

  const runAction = (action: (selectedNote: Note) => void): void => {
    setIsMenuOpen(false)
    action(note)
  }

  return (
    <article className={`note-card${isMenuOpen ? ' note-card-menu-open' : ''}`}>
      <button
        className="note-card-open-target"
        aria-label={t('{{title}} notunu aç', { title: note.title })}
        onClick={() => onOpen(note)}
        type="button"
      />
      <div className="note-card-heading">
        <div>
          <p className="note-kicker">{t('Not')}</p>
          <h2>{note.title}</h2>
        </div>
        {showDragHandle ? (
          <span className="note-card-drag-handle" aria-hidden="true" title={t('Kartı sürükle')}>
            ⠇
          </span>
        ) : null}
        <div className="card-menu-container">
          <button
            className="card-menu-trigger"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={t('{{title}} işlemleri', { title: note.title })}
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true">•••</span>
          </button>
          {isMenuOpen ? (
            <div className="card-menu" role="menu">
              <button onClick={() => runAction(onSetPinned)} role="menuitem" type="button">
                {note.isPinned ? t('Sabitlemeyi kaldır') : t('Sabitle')}
              </button>
              <button onClick={() => runAction(onSetFavorite)} role="menuitem" type="button">
                {note.isFavorite ? t('Favoriden çıkar') : t('Favoriye ekle')}
              </button>
              <button onClick={() => runAction(onManageTags)} role="menuitem" type="button">
                {t('Etiketleri yönet')}
              </button>
              <button onClick={() => runAction(onArchive)} role="menuitem" type="button">
                {t('Arşivle')}
              </button>
              <button onClick={() => runAction(onRename)} role="menuitem" type="button">
                {t('Yeniden adlandır')}
              </button>
              <button onClick={() => runAction(onDuplicate)} role="menuitem" type="button">
                {t('Çoğalt')}
              </button>
              <button
                className="danger-menu-item"
                onClick={() => runAction(onDelete)}
                role="menuitem"
                type="button"
              >
                {t('Çöp kutusuna taşı')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {note.isPinned || note.isFavorite || (note.tags?.length ?? 0) > 0 ? (
        <div className="note-card-metadata" aria-label="Not durumu ve etiketleri">
          {note.isPinned ? (
            <span className="note-status-icon" title={t('Sabitlenmiş')}>
              <span aria-hidden="true">⌖</span>
              <span className="sr-only">{t('Sabitlenmiş')}</span>
            </span>
          ) : null}
          {note.isFavorite ? (
            <span className="note-status-icon favorite" title={t('Favori')}>
              <span aria-hidden="true">★</span>
              <span className="sr-only">{t('Favori')}</span>
            </span>
          ) : null}
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
      <time dateTime={note.updatedAt}>
        {t('Son düzenleme {{time}}', {
          time: updatedAtFormatter.format(new Date(note.updatedAt)),
        })}
      </time>
    </article>
  )
}
