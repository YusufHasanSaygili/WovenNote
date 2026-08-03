import { z } from 'zod'

import { IpcErrorSchema } from './note-contracts'

export const AttachmentSchema = z
  .object({
    id: z.string().min(1),
    noteId: z.string().min(1),
    blockId: z.string().nullable(),
    originalFileName: z.string().min(1),
    mimeType: z.string().min(1),
    fileSize: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    createdAt: z.string().min(1),
  })
  .strict()

export const PickAttachmentInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    accept: z.enum(['all', 'image', 'video', 'file']).optional(),
  })
  .strict()

export const PickAttachmentOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }).strict(),
  z.object({ status: z.literal('stored'), attachment: AttachmentSchema }).strict(),
])

export const PickAttachmentResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: PickAttachmentOutcomeSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const AttachmentIdInputSchema = z
  .object({ attachmentId: z.string().min(1).max(100) })
  .strict()

export const GetAttachmentResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: AttachmentSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const OpenAttachmentResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ opened: z.literal(true) }).strict() }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type Attachment = z.infer<typeof AttachmentSchema>
export type AttachmentAccept = 'all' | 'image' | 'video' | 'file'
export type AttachmentIdInput = z.infer<typeof AttachmentIdInputSchema>
export type GetAttachmentResult = z.infer<typeof GetAttachmentResultSchema>
export type OpenAttachmentResult = z.infer<typeof OpenAttachmentResultSchema>
export type PickAttachmentInput = z.infer<typeof PickAttachmentInputSchema>
export type PickAttachmentOutcome = z.infer<typeof PickAttachmentOutcomeSchema>
export type PickAttachmentResult = z.infer<typeof PickAttachmentResultSchema>
