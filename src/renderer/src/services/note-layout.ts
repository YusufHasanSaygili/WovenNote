import type { Layout, LayoutItem } from 'react-grid-layout'

import type { Note, NoteLayoutUpdate } from '../../../shared/schemas/note-contracts'

export const GRID_COLUMNS = 12
export const MIN_CARD_WIDTH = 3
export const MAX_CARD_WIDTH = 6
export const MIN_CARD_HEIGHT = 2
export const MAX_CARD_HEIGHT = 8

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.round(value), minimum), maximum)
}

export function noteToLayoutItem(note: Note): LayoutItem {
  const gridWidth = clamp(note.gridWidth, MIN_CARD_WIDTH, MAX_CARD_WIDTH)

  return {
    i: note.id,
    x: clamp(note.gridX, 0, GRID_COLUMNS - gridWidth),
    y: Math.max(0, Math.round(note.gridY)),
    w: gridWidth,
    h: clamp(note.gridHeight, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT),
    minW: MIN_CARD_WIDTH,
    maxW: MAX_CARD_WIDTH,
    minH: MIN_CARD_HEIGHT,
    maxH: MAX_CARD_HEIGHT,
    isBounded: true,
    resizeHandles: ['se'],
  }
}

function columnMask(x: number, width: number): number {
  return ((1 << width) - 1) << x
}

function canPlace(
  item: LayoutItem,
  x: number,
  y: number,
  occupiedRows: ReadonlyMap<number, number>,
): boolean {
  const mask = columnMask(x, item.w)

  for (let row = y; row < y + item.h; row += 1) {
    if (((occupiedRows.get(row) ?? 0) & mask) !== 0) return false
  }

  return true
}

function occupy(item: LayoutItem, occupiedRows: Map<number, number>): void {
  const mask = columnMask(item.x, item.w)

  for (let row = item.y; row < item.y + item.h; row += 1) {
    occupiedRows.set(row, (occupiedRows.get(row) ?? 0) | mask)
  }
}

function findFirstAvailablePosition(
  item: LayoutItem,
  placedItems: readonly LayoutItem[],
  occupiedRows: ReadonlyMap<number, number>,
): Pick<LayoutItem, 'x' | 'y'> {
  const candidateRows = [...new Set([0, ...placedItems.map((placed) => placed.y + placed.h)])].sort(
    (left, right) => left - right,
  )

  for (const y of candidateRows) {
    for (let x = 0; x <= GRID_COLUMNS - item.w; x += 1) {
      if (canPlace(item, x, y, occupiedRows)) return { x, y }
    }
  }

  const y = placedItems.reduce((lowestOpenRow, placed) => {
    return Math.max(lowestOpenRow, placed.y + placed.h)
  }, 0)
  return { x: 0, y }
}

export function notesToLayout(notes: readonly Note[]): Layout {
  const placedItems: LayoutItem[] = []
  const occupiedRows = new Map<number, number>()

  for (const note of notes) {
    const requestedItem = noteToLayoutItem(note)
    const item = canPlace(requestedItem, requestedItem.x, requestedItem.y, occupiedRows)
      ? requestedItem
      : {
          ...requestedItem,
          ...findFirstAvailablePosition(requestedItem, placedItems, occupiedRows),
        }

    placedItems.push(item)
    occupy(item, occupiedRows)
  }

  return placedItems
}

export function layoutToUpdates(layout: Layout): NoteLayoutUpdate[] {
  return layout.map((item) => {
    const gridWidth = clamp(item.w, MIN_CARD_WIDTH, MAX_CARD_WIDTH)

    return {
      id: item.i,
      gridX: clamp(item.x, 0, GRID_COLUMNS - gridWidth),
      gridY: Math.max(0, Math.round(item.y)),
      gridWidth,
      gridHeight: clamp(item.h, MIN_CARD_HEIGHT, MAX_CARD_HEIGHT),
    }
  })
}

export function applyLayoutToNotes(notes: readonly Note[], layout: Layout): Note[] {
  const updates = new Map(layoutToUpdates(layout).map((item) => [item.id, item]))
  let changed = false
  const nextNotes = notes.map((note) => {
    const update = updates.get(note.id)
    if (
      !update ||
      (note.gridX === update.gridX &&
        note.gridY === update.gridY &&
        note.gridWidth === update.gridWidth &&
        note.gridHeight === update.gridHeight)
    ) {
      return note
    }

    changed = true
    return { ...note, ...update }
  })

  return changed ? nextNotes : (notes as Note[])
}
