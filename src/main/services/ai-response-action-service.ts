import type { AiResponseActionInput } from '../../shared/schemas/ai-chat-contracts'
import {
  parseEditorEnvelopeJson,
  TiptapDocumentSchema,
  type TiptapDocument,
} from '../../shared/schemas/editor-document'
import type { Note } from '../../shared/schemas/note-contracts'
import type { ChatRepository } from '../repositories/chat-repository'
import type { NoteRepository } from '../repositories/note-repository'
import type { NoteService } from './note-service'

const MAX_RESPONSE_BLOCKS = 500

export interface AiResponseActionDependencies {
  readonly writeClipboard: (text: string) => void
}

export class AiResponseActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiResponseActionError'
  }
}

export function responseTextToDocument(text: string): TiptapDocument {
  const normalized = text.trim()
  if (!normalized) throw new AiResponseActionError('Boş bir AI yanıtı kullanılamaz.')

  const sections = normalized
    .split(/\r?\n\s*\r?\n/u)
    .map((section) => section.replace(/\s*\r?\n\s*/gu, ' ').trim())
    .filter(Boolean)
  const kept = sections.slice(0, MAX_RESPONSE_BLOCKS)
  if (sections.length > MAX_RESPONSE_BLOCKS) {
    kept[MAX_RESPONSE_BLOCKS - 1] = sections.slice(MAX_RESPONSE_BLOCKS - 1).join(' ')
  }

  return TiptapDocumentSchema.parse({
    type: 'doc',
    content: kept.map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    })),
  })
}

export class AiResponseActionService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly notes: NoteRepository,
    private readonly noteService: NoteService,
    private readonly dependencies: AiResponseActionDependencies,
  ) {}

  copyResponse(input: AiResponseActionInput): { copied: true } {
    const message = this.requireMessage(input)
    this.dependencies.writeClipboard(message.content)
    return { copied: true }
  }

  appendResponseToNote(input: AiResponseActionInput): Note {
    const message = this.requireMessage(input)
    const note = this.requireActiveNote(input.noteId)
    const response = responseTextToDocument(message.content)
    const current = parseEditorEnvelopeJson(note.contentJson).content
    const currentDocument = TiptapDocumentSchema.parse(current)
    const hasOnlyEmptyParagraph =
      currentDocument.content.length === 1 &&
      currentDocument.content[0]?.type === 'paragraph' &&
      !currentDocument.content[0].content?.length
    const existingContent = hasOnlyEmptyParagraph ? [] : currentDocument.content
    const document = TiptapDocumentSchema.parse({
      type: 'doc',
      content: [...existingContent, ...response.content],
    })

    return this.noteService.saveContent({
      id: note.id,
      title: note.title,
      document: { documentVersion: 1, editor: 'tiptap', content: document },
    })
  }

  createNoteFromResponse(input: AiResponseActionInput): Note {
    const message = this.requireMessage(input)
    const source = this.requireActiveNote(input.noteId)
    const suffix = ' — AI yanıtı'
    const title = `${source.title.slice(0, 200 - suffix.length)}${suffix}`
    return this.noteService.createWithContent(title, responseTextToDocument(message.content))
  }

  private requireMessage(input: AiResponseActionInput) {
    const message = this.chats.findCompletedAssistantMessage(input.noteId, input.messageId)
    if (!message) {
      throw new AiResponseActionError('Bu AI yanıtı belirtilen nota ait değil veya tamamlanmadı.')
    }
    return message
  }

  private requireActiveNote(noteId: string): Note {
    const note = this.notes.findById(noteId)
    if (!note || note.deletedAt) throw new AiResponseActionError('Not bulunamadı.')
    return note
  }
}
