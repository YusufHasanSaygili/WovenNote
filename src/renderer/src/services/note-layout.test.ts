import { describe, expect, it } from 'vitest'

import type { Note } from '../../../shared/schemas/note-contracts'
import { applyLayoutToNotes, noteToLayoutItem, notesToLayout } from './note-layout'

function exampleNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'layout-note',
    title: 'Yerleşim',
    preview: '',
    searchText: '',
    contentJson: '{"documentVersion":1,"editor":"tiptap","content":{}}',
    color: '#fff4bd',
    gridX: 0,
    gridY: 0,
    gridWidth: 3,
    gridHeight: 4,
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    deletedAt: null,
    lastOpenedAt: null,
    createdAt: '2026-07-28T14:00:00.000Z',
    updatedAt: '2026-07-28T14:00:00.000Z',
    ...overrides,
  }
}

describe('note layout mapping', () => {
  it('clamps malformed persisted values so a card stays inside the 12-column board', () => {
    expect(
      noteToLayoutItem(exampleNote({ gridX: 99, gridY: -5, gridWidth: 20, gridHeight: 1 })),
    ).toMatchObject({ x: 6, y: 0, w: 6, h: 2, minW: 3, maxW: 6, minH: 2, maxH: 8 })
  })

  it.each([
    [3, 4],
    [4, 3],
    [6, 2],
  ])('accepts the documented %sx%s modular size', (gridWidth, gridHeight) => {
    expect(noteToLayoutItem(exampleNote({ gridWidth, gridHeight }))).toMatchObject({
      w: gridWidth,
      h: gridHeight,
    })
  })

  it('packs four overlapping compact cards side by side before starting a new row', () => {
    const layout = notesToLayout(
      Array.from({ length: 5 }, (_, index) =>
        exampleNote({ id: `compact-${index + 1}`, gridWidth: 3, gridHeight: 4 }),
      ),
    )

    expect(layout.map(({ x, y, w }) => ({ x, y, w }))).toEqual([
      { x: 0, y: 0, w: 3 },
      { x: 3, y: 0, w: 3 },
      { x: 6, y: 0, w: 3 },
      { x: 9, y: 0, w: 3 },
      { x: 0, y: 4, w: 3 },
    ])
  })

  it('fits two widest cards side by side and clamps legacy full-width values', () => {
    const layout = notesToLayout([
      exampleNote({ id: 'wide-1', gridWidth: 12 }),
      exampleNote({ id: 'wide-2', gridWidth: 12 }),
    ])

    expect(layout.map(({ x, y, w }) => ({ x, y, w }))).toEqual([
      { x: 0, y: 0, w: 6 },
      { x: 6, y: 0, w: 6 },
    ])
  })

  it('preserves deliberate non-overlapping persisted positions', () => {
    const layout = notesToLayout([
      exampleNote({ id: 'left', gridX: 0, gridY: 0 }),
      exampleNote({ id: 'right', gridX: 9, gridY: 8 }),
    ])

    expect(layout.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 8 },
    ])
  })

  it('applies a layout without changing unrelated note data', () => {
    const note = exampleNote()
    const updated = applyLayoutToNotes([note], [{ i: note.id, x: 6, y: 3, w: 6, h: 2 }])

    expect(updated[0]).toEqual({
      ...note,
      gridX: 6,
      gridY: 3,
      gridWidth: 6,
      gridHeight: 2,
    })
  })
})
