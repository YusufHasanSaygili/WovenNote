import { z } from 'zod'

import { IpcErrorSchema, NoteSchema } from './note-contracts'
import { TAG_COLORS, TagSchema } from './tag-schema'

const TagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}\s_-]*$/u, {
    message: 'Etiket adı harf veya rakamla başlamalıdır.',
  })
  .transform((name) => name.replace(/\s+/gu, ' '))

export const CreateTagInputSchema = z
  .object({ name: TagNameSchema, color: z.enum(TAG_COLORS) })
  .strict()
export const ListTagsInputSchema = z.object({}).strict()
export const SetNoteTagsInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    tagIds: z.array(z.string().min(1).max(100)).max(20),
  })
  .strict()
  .refine((input) => new Set(input.tagIds).size === input.tagIds.length, {
    message: 'Aynı etiket bir nota birden fazla atanamaz.',
  })
export const SetNoteFlagInputSchema = z
  .object({ id: z.string().min(1).max(100), value: z.boolean() })
  .strict()

export const TagMutationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: TagSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])
export const ListTagsResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.array(TagSchema) }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])
export const OrganizationNoteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: NoteSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type CreateTagInput = z.infer<typeof CreateTagInputSchema>
export type CreateTagResult = z.infer<typeof TagMutationResultSchema>
export type ListTagsResult = z.infer<typeof ListTagsResultSchema>
export type SetNoteTagsInput = z.infer<typeof SetNoteTagsInputSchema>
export type SetNoteFlagInput = z.infer<typeof SetNoteFlagInputSchema>
export type OrganizationNoteResult = z.infer<typeof OrganizationNoteResultSchema>
