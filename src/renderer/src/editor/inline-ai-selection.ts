import type { Editor, JSONContent } from '@tiptap/core'

import type { InlineAiAction } from '../../../shared/schemas/inline-ai-contracts'

export interface InlineAiSelectionSnapshot {
  readonly from: number
  readonly to: number
  readonly text: string
}

export function captureInlineAiSelection(editor: Editor): InlineAiSelectionSnapshot | null {
  const { from, to, empty } = editor.state.selection
  if (empty) return null
  const text = editor.state.doc.textBetween(from, to, '\n')
  if (!text.trim() || text.trim().length > 8_000) return null
  return { from, to, text }
}

export function inlineAiSelectionStillMatches(
  editor: Editor,
  snapshot: InlineAiSelectionSnapshot,
): boolean {
  if (
    snapshot.from < 0 ||
    snapshot.to > editor.state.doc.content.size ||
    snapshot.from >= snapshot.to
  )
    return false
  return editor.state.doc.textBetween(snapshot.from, snapshot.to, '\n') === snapshot.text
}

function listContent(text: string): JSONContent {
  const items = text
    .trim()
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:(?:[-*•])|(?:\d+[.)]))\s*/u, '').trim())
    .filter(Boolean)
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  }
}

export function applyInlineAiResult(
  editor: Editor,
  snapshot: InlineAiSelectionSnapshot,
  action: InlineAiAction,
  resultText: string,
): boolean {
  const normalized = resultText.trim()
  if (!normalized || !inlineAiSelectionStillMatches(editor, snapshot)) return false
  const content: JSONContent =
    action === 'list'
      ? listContent(normalized)
      : { type: 'text', text: normalized.replace(/\s*\r?\n\s*/gu, ' ') }
  if (action === 'list' && !content.content?.length) return false
  return editor.commands.insertContentAt({ from: snapshot.from, to: snapshot.to }, content, {
    updateSelection: true,
  })
}
