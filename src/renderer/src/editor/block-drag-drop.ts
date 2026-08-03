import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

import type { MediaAlignment } from './MediaAlignmentControls'

const BLOCK_DRAG_DATA_TYPE = 'application/x-wovennote-block-index'
const blockDragPluginKey = new PluginKey('wovennote-block-drag-drop')
const ALIGNABLE_MEDIA_TYPES = new Set(['attachmentVideo', 'youtubeVideo'])

function blockLabel(nodeName: string): string {
  return (
    {
      attachmentFile: 'Dosya eki',
      attachmentImage: 'Görsel',
      attachmentVideo: 'Video',
      youtubeVideo: 'YouTube videosu',
      blockquote: 'Alıntı',
      bulletList: 'Madde listesi',
      codeBlock: 'Kod',
      heading: 'Başlık',
      horizontalRule: 'Ayırıcı',
      orderedList: 'Numaralı liste',
      paragraph: 'Paragraf',
      taskList: 'Görev listesi',
    }[nodeName] ?? 'Blok'
  )
}

export function blockIndexAtPosition(document: ProseMirrorNode, position: number): number {
  let foundIndex = Math.max(0, document.childCount - 1)
  document.forEach((node, offset, index) => {
    if (position >= offset && position <= offset + node.nodeSize) {
      foundIndex = index
    }
  })
  return foundIndex
}

export function moveTopLevelBlock(view: EditorView, fromIndex: number, toIndex: number): boolean {
  const { doc } = view.state
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= doc.childCount ||
    toIndex >= doc.childCount ||
    fromIndex === toIndex
  ) {
    return false
  }

  const blocks: ProseMirrorNode[] = []
  doc.forEach((node) => blocks.push(node))
  const [movedBlock] = blocks.splice(fromIndex, 1)
  if (!movedBlock) return false
  blocks.splice(toIndex, 0, movedBlock)

  view.dispatch(view.state.tr.replaceWith(0, doc.content.size, blocks).scrollIntoView())
  return true
}

export function mediaAlignmentAtPointer(
  editorElement: HTMLElement,
  pointerX: number,
): MediaAlignment {
  const bounds = editorElement.getBoundingClientRect()
  if (bounds.width <= 0) return 'center'
  const relativePosition = (pointerX - bounds.left) / bounds.width
  if (relativePosition < 1 / 3) return 'left'
  if (relativePosition > 2 / 3) return 'right'
  return 'center'
}

export function alignTopLevelMedia(
  view: EditorView,
  blockIndex: number,
  alignment: MediaAlignment,
): boolean {
  if (blockIndex < 0 || blockIndex >= view.state.doc.childCount) return false
  const node = view.state.doc.child(blockIndex)
  if (!ALIGNABLE_MEDIA_TYPES.has(node.type.name) || node.attrs['alignment'] === alignment) {
    return false
  }

  let nodePosition = 0
  view.state.doc.forEach((_child, offset, index) => {
    if (index === blockIndex) nodePosition = offset
  })
  view.dispatch(
    view.state.tr
      .setNodeMarkup(nodePosition, undefined, { ...node.attrs, alignment })
      .scrollIntoView(),
  )
  return true
}

function scrollableAncestor(element: HTMLElement): HTMLElement {
  let candidate: HTMLElement | null = element
  while (candidate) {
    if (candidate.scrollHeight > candidate.clientHeight) return candidate
    candidate = candidate.parentElement
  }
  return element
}

export function autoScrollDuringBlockDrag(
  editorElement: HTMLElement,
  pointerY: number,
  edgeDistance = 64,
  step = 36,
): number {
  const container = scrollableAncestor(editorElement)
  const bounds = container.getBoundingClientRect()
  const direction =
    pointerY < bounds.top + edgeDistance ? -1 : pointerY > bounds.bottom - edgeDistance ? 1 : 0
  if (direction !== 0) container.scrollBy({ top: direction * step, behavior: 'auto' })
  return direction
}

function dragIndex(event: DragEvent): number | null {
  const rawIndex = event.dataTransfer?.getData(BLOCK_DRAG_DATA_TYPE)
  if (!rawIndex || !/^\d+$/.test(rawIndex)) return null
  return Number(rawIndex)
}

function dropPosition(view: EditorView, event: DragEvent): number | undefined {
  if (event.target instanceof Node) {
    let blockElement: Node = event.target
    while (blockElement.parentNode && blockElement.parentNode !== view.dom) {
      blockElement = blockElement.parentNode
    }
    if (blockElement.parentNode === view.dom) {
      try {
        return view.posAtDOM(blockElement, 0)
      } catch {
        // Coordinate resolution below remains the safe fallback for synthetic and edge drops.
      }
    }
  }

  return view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
}

function createHandle(view: EditorView, node: ProseMirrorNode, index: number): HTMLButtonElement {
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'block-drag-handle'
  handle.draggable = true
  handle.contentEditable = 'false'
  handle.dataset['blockIndex'] = String(index)
  const canAlign = ALIGNABLE_MEDIA_TYPES.has(node.type.name)
  handle.setAttribute(
    'aria-label',
    `${blockLabel(node.type.name)} bloğunu taşı. Alt ve yukarı veya aşağı ok tuşlarını kullanabilirsiniz.${canAlign ? ' Alt ve sol veya sağ ok tuşları videoyu hizalar.' : ''}`,
  )
  handle.setAttribute(
    'aria-keyshortcuts',
    canAlign
      ? 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
      : 'Alt+ArrowUp Alt+ArrowDown',
  )
  handle.textContent = '⋮⋮'

  handle.addEventListener('dragstart', (event) => {
    event.stopPropagation()
    event.dataTransfer?.setData(BLOCK_DRAG_DATA_TYPE, String(index))
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    handle.classList.add('is-dragging')
  })
  handle.addEventListener('dragend', (event) => {
    event.stopPropagation()
    handle.classList.remove('is-dragging')
  })
  handle.addEventListener('keydown', (event) => {
    if (!event.altKey) return
    if (canAlign && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      const alignment = event.key === 'ArrowLeft' ? 'left' : 'right'
      if (!alignTopLevelMedia(view, index, alignment)) return
      queueMicrotask(() => {
        view.dom
          .querySelector<HTMLButtonElement>(`.block-drag-handle[data-block-index="${index}"]`)
          ?.focus()
      })
      return
    }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'ArrowUp' ? index - 1 : index + 1
    if (!moveTopLevelBlock(view, index, nextIndex)) return
    queueMicrotask(() => {
      view.dom
        .querySelector<HTMLButtonElement>(`.block-drag-handle[data-block-index="${nextIndex}"]`)
        ?.focus()
    })
  })

  return handle
}

export const BlockDragDrop = Extension.create({
  name: 'blockDragDrop',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockDragPluginKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []
            state.doc.forEach((node, offset, index) => {
              decorations.push(
                Decoration.widget(offset, (view) => createHandle(view, node, index), {
                  key: `block-handle-${index}-${node.type.name}`,
                  side: -1,
                }),
              )
            })
            return DecorationSet.create(state.doc, decorations)
          },
          handleDOMEvents: {
            dragover: (view, event) => {
              if (!event.dataTransfer?.types.includes(BLOCK_DRAG_DATA_TYPE)) return false
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              autoScrollDuringBlockDrag(view.dom, event.clientY)
              return true
            },
            drop: (view, event) => {
              const fromIndex = dragIndex(event)
              if (fromIndex === null) return false
              event.preventDefault()
              const position = dropPosition(view, event)
              if (position === undefined) return true
              const toIndex = blockIndexAtPosition(view.state.doc, position)
              if (fromIndex === toIndex) {
                alignTopLevelMedia(
                  view,
                  fromIndex,
                  mediaAlignmentAtPointer(view.dom, event.clientX),
                )
              } else {
                moveTopLevelBlock(view, fromIndex, toIndex)
              }
              return true
            },
          },
        },
      }),
    ]
  },
})
