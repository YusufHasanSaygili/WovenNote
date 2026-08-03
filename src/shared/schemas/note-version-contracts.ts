import { z } from 'zod'

import { EditorDocumentEnvelopeSchema } from './editor-document'
import { IpcErrorSchema, NoteSchema } from './note-contracts'

export const NoteVersionSchema = z
  .object({
    id: z.string().min(1).max(100),
    noteId: z.string().min(1).max(100),
    document: EditorDocumentEnvelopeSchema,
    preview: z.string().max(240),
    reason: z.enum(['autosave', 'restore']),
    createdAt: z.iso.datetime(),
  })
  .strict()

export const ListNoteVersionsInputSchema = z.object({ noteId: z.string().min(1).max(100) }).strict()

export const RestoreNoteVersionInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    versionId: z.string().min(1).max(100),
    confirmation: z.literal('RESTORE_VERSION'),
  })
  .strict()

export const ListNoteVersionsResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.array(NoteVersionSchema) }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const RestoreNoteVersionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: NoteSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type ListNoteVersionsInput = z.infer<typeof ListNoteVersionsInputSchema>
export type ListNoteVersionsResult = z.infer<typeof ListNoteVersionsResultSchema>
export type NoteVersion = z.infer<typeof NoteVersionSchema>
export type RestoreNoteVersionInput = z.infer<typeof RestoreNoteVersionInputSchema>
export type RestoreNoteVersionResult = z.infer<typeof RestoreNoteVersionResultSchema>
