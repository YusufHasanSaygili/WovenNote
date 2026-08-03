import { z } from 'zod'

import { EditorDocumentEnvelopeSchema } from './editor-document'
import { TagSchema } from './tag-schema'

export const NoteSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    preview: z.string(),
    searchText: z.string(),
    contentJson: z.string(),
    color: z.string().min(1),
    gridX: z.number().int().nonnegative(),
    gridY: z.number().int().nonnegative(),
    gridWidth: z.number().int().positive(),
    gridHeight: z.number().int().positive(),
    isPinned: z.boolean(),
    isFavorite: z.boolean(),
    isArchived: z.boolean(),
    deletedAt: z.string().nullable(),
    lastOpenedAt: z.string().nullable(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    tags: z.array(TagSchema).max(20).optional(),
  })
  .strict()

export const CreateNoteInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict()

export const ListNotesInputSchema = z.object({}).strict()

export const SearchNotesInputSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict()

export const NoteIdInputSchema = z.object({ id: z.string().min(1).max(100) }).strict()

export const PermanentlyDeleteNoteInputSchema = z
  .object({
    id: z.string().min(1).max(100),
    confirmation: z.literal('PERMANENT_DELETE'),
  })
  .strict()

export const RenameNoteInputSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(200),
  })
  .strict()

export const SaveNoteContentInputSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    document: EditorDocumentEnvelopeSchema,
  })
  .strict()

export const NoteLayoutUpdateSchema = z
  .object({
    id: z.string().min(1).max(100),
    gridX: z.number().int().min(0).max(11),
    gridY: z.number().int().min(0).max(100_000),
    gridWidth: z.number().int().min(3).max(6),
    gridHeight: z.number().int().min(2).max(8),
  })
  .strict()
  .refine((layout) => layout.gridX + layout.gridWidth <= 12, {
    message: 'Kart yatay grid sınırlarını aşamaz.',
  })

export const UpdateNoteLayoutsInputSchema = z
  .object({
    layouts: z.array(NoteLayoutUpdateSchema).min(1).max(500),
  })
  .strict()
  .refine(
    (input) => new Set(input.layouts.map((layout) => layout.id)).size === input.layouts.length,
    {
      message: 'Aynı not bir yerleşim paketinde birden fazla kez gönderilemez.',
    },
  )

export const IpcErrorSchema = z
  .object({
    code: z.enum(['VALIDATION_ERROR', 'OPERATION_FAILED']),
    message: z.string().min(1),
  })
  .strict()

export const CreateNoteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: NoteSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const ListNotesResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.array(NoteSchema) }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const SearchNotesResultSchema = ListNotesResultSchema

export const NoteMutationResultSchema = CreateNoteResultSchema

export const SoftDeleteNoteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ id: z.string().min(1) }).strict() }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const PermanentlyDeleteNoteResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      data: z
        .object({
          id: z.string().min(1),
          cleanedAttachmentFiles: z.number().int().nonnegative(),
          preservedSharedAttachments: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const UpdateNoteLayoutsResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      data: z.object({ updatedIds: z.array(z.string().min(1)) }).strict(),
    })
    .strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type Note = z.infer<typeof NoteSchema>
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>
export type CreateNoteResult = z.infer<typeof CreateNoteResultSchema>
export type ListNotesInput = z.infer<typeof ListNotesInputSchema>
export type ListNotesResult = z.infer<typeof ListNotesResultSchema>
export type SearchNotesInput = z.infer<typeof SearchNotesInputSchema>
export type SearchNotesResult = z.infer<typeof SearchNotesResultSchema>
export type NoteIdInput = z.infer<typeof NoteIdInputSchema>
export type PermanentlyDeleteNoteInput = z.infer<typeof PermanentlyDeleteNoteInputSchema>
export type PermanentlyDeleteNoteResult = z.infer<typeof PermanentlyDeleteNoteResultSchema>
export type RenameNoteInput = z.infer<typeof RenameNoteInputSchema>
export type SaveNoteContentInput = z.infer<typeof SaveNoteContentInputSchema>
export type NoteLayoutUpdate = z.infer<typeof NoteLayoutUpdateSchema>
export type UpdateNoteLayoutsInput = z.infer<typeof UpdateNoteLayoutsInputSchema>
export type UpdateNoteLayoutsResult = z.infer<typeof UpdateNoteLayoutsResultSchema>
export type NoteMutationResult = z.infer<typeof NoteMutationResultSchema>
export type SoftDeleteNoteResult = z.infer<typeof SoftDeleteNoteResultSchema>
