import { z } from 'zod'

import { EditorDocumentEnvelopeSchema } from './editor-document'
import { IpcErrorSchema } from './note-contracts'
import { TagSchema } from './tag-schema'

export const NoteExportFormatSchema = z.enum(['markdown', 'txt', 'json', 'pdf'])

export const ExportNoteInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    format: NoteExportFormatSchema,
  })
  .strict()

export const NoteExportFileSchema = z
  .object({
    format: z.literal('wovennote-note'),
    exportVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    note: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        document: EditorDocumentEnvelopeSchema,
        color: z.string().min(1),
        gridX: z.number().int().nonnegative(),
        gridY: z.number().int().nonnegative(),
        gridWidth: z.number().int().positive(),
        gridHeight: z.number().int().positive(),
        isPinned: z.boolean(),
        isFavorite: z.boolean(),
        createdAt: z.string().min(1),
        updatedAt: z.string().min(1),
        tags: z.array(TagSchema).max(20),
      })
      .strict(),
  })
  .strict()

export const ExportNoteOutcomeSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('saved'),
      format: NoteExportFormatSchema,
      fileName: z.string().min(1).max(255),
      bytesWritten: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ status: z.literal('cancelled') }).strict(),
])

export const ExportNoteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: ExportNoteOutcomeSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type NoteExportFormat = z.infer<typeof NoteExportFormatSchema>
export type ExportNoteInput = z.infer<typeof ExportNoteInputSchema>
export type NoteExportFile = z.infer<typeof NoteExportFileSchema>
export type ExportNoteOutcome = z.infer<typeof ExportNoteOutcomeSchema>
export type ExportNoteResult = z.infer<typeof ExportNoteResultSchema>
