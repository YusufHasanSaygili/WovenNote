import { useEffect, useMemo } from 'react'
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
} from 'react-grid-layout'

import type { Note } from '../../../shared/schemas/note-contracts'
import { useI18n } from '../i18n/i18n'
import { applyLayoutToNotes, GRID_COLUMNS, notesToLayout } from '../services/note-layout'
import { NoteCard } from './NoteCard'

interface NoteGridProps {
  readonly notes: readonly Note[]
  readonly onArchive: (note: Note) => void
  readonly onDelete: (note: Note) => void
  readonly onDuplicate: (note: Note) => void
  readonly onLayoutChange: (layout: Layout) => void
  readonly onManageTags: (note: Note) => void
  readonly onOpen: (note: Note) => void
  readonly onRename: (note: Note) => void
  readonly onSetFavorite: (note: Note) => void
  readonly onSetPinned: (note: Note) => void
}

export function NoteGrid({
  notes,
  onArchive,
  onDelete,
  onDuplicate,
  onLayoutChange,
  onManageTags,
  onOpen,
  onRename,
  onSetFavorite,
  onSetPinned,
}: NoteGridProps): React.JSX.Element {
  const { t } = useI18n()
  const { containerRef, mounted, width } = useContainerWidth({ initialWidth: 960 })
  const layout = useMemo(() => notesToLayout(notes), [notes])

  useEffect(() => {
    if (applyLayoutToNotes(notes, layout) !== notes) onLayoutChange(layout)
  }, [layout, notes, onLayoutChange])

  return (
    <div className="note-grid-region" ref={containerRef} aria-label={t('Notlar')} data-view="grid">
      {mounted ? (
        <ReactGridLayout
          className="note-layout-grid"
          compactor={verticalCompactor}
          dragConfig={{
            bounded: true,
            cancel: '.card-menu-container, button, a, input, textarea, select',
            enabled: true,
            handle: '.note-card-drag-handle',
            threshold: 3,
          }}
          gridConfig={{
            cols: GRID_COLUMNS,
            containerPadding: [0, 0],
            margin: [18, 18],
            maxRows: Number.POSITIVE_INFINITY,
            rowHeight: 44,
          }}
          layout={layout}
          onDragStop={onLayoutChange}
          onResizeStop={onLayoutChange}
          resizeConfig={{ enabled: true, handles: ['se'] }}
          width={Math.max(width, 320)}
        >
          {notes.map((note) => (
            <div className="note-grid-item" key={note.id} data-note-id={note.id}>
              <NoteCard
                note={note}
                onArchive={onArchive}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onManageTags={onManageTags}
                onOpen={onOpen}
                onRename={onRename}
                onSetFavorite={onSetFavorite}
                onSetPinned={onSetPinned}
                showDragHandle
              />
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  )
}
