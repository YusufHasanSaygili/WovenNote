import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface EditorTextMatch {
  readonly from: number
  readonly to: number
}

export function findEditorTextMatches(
  document: ProseMirrorNode,
  rawQuery: string,
): EditorTextMatch[] {
  const query = rawQuery.trim().toLocaleLowerCase('tr-TR')
  if (!query) return []

  let searchableText = ''
  const positions: number[] = []
  document.descendants((node, position) => {
    if (node.isText && node.text) {
      for (let index = 0; index < node.text.length; index += 1) {
        searchableText += node.text[index]
        positions.push(position + index)
      }
      return
    }
    if (node.isBlock && searchableText && !searchableText.endsWith('\n')) {
      searchableText += '\n'
      positions.push(position)
    }
  })

  const normalizedText = searchableText.toLocaleLowerCase('tr-TR')
  const matches: EditorTextMatch[] = []
  let searchFrom = 0
  while (searchFrom < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(query, searchFrom)
    if (matchIndex < 0) break
    const from = positions[matchIndex]
    const lastPosition = positions[matchIndex + query.length - 1]
    if (from !== undefined && lastPosition !== undefined) {
      matches.push({ from, to: lastPosition + 1 })
    }
    searchFrom = matchIndex + Math.max(1, query.length)
  }
  return matches
}

export function selectEditorTextMatch(editor: Editor, match: EditorTextMatch | undefined): void {
  if (match) editor.commands.setTextSelection(match)
}
