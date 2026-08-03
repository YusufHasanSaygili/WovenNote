import { z } from 'zod'

import { IpcErrorSchema, NoteIdInputSchema, NoteSchema } from './note-contracts'

export const ChatMessageSchema = z
  .object({
    id: z.uuid(),
    sessionId: z.uuid(),
    role: z.enum(['user', 'assistant']),
    content: z.string().max(100_000),
    status: z.enum(['pending', 'complete', 'error', 'cancelled']),
    createdAt: z.iso.datetime(),
  })
  .strict()

export const ChatThreadSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    sessionId: z.uuid().nullable(),
    messages: z.array(ChatMessageSchema).max(500),
  })
  .strict()

export const GetChatThreadInputSchema = NoteIdInputSchema

export const SendChatMessageInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    requestId: z.uuid(),
    message: z.string().trim().min(1).max(8_000),
  })
  .strict()

export const SendChatMessageDataSchema = z
  .object({
    thread: ChatThreadSchema,
    contextTruncated: z.boolean(),
  })
  .strict()

export const CancelAiRequestInputSchema = z.object({ requestId: z.uuid() }).strict()
export const CancelAiRequestDataSchema = z.object({ cancelled: z.boolean() }).strict()

export const AiResponseActionInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    messageId: z.uuid(),
  })
  .strict()

export const CopyAiResponseDataSchema = z.object({ copied: z.literal(true) }).strict()

export const CopyAiResponseResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: CopyAiResponseDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const AiResponseNoteResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: NoteSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const ChatThreadResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: ChatThreadSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const SendChatMessageResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: SendChatMessageDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const CancelAiRequestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: CancelAiRequestDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type CancelAiRequestInput = z.infer<typeof CancelAiRequestInputSchema>
export type CancelAiRequestResult = z.infer<typeof CancelAiRequestResultSchema>
export type AiResponseActionInput = z.infer<typeof AiResponseActionInputSchema>
export type AiResponseNoteResult = z.infer<typeof AiResponseNoteResultSchema>
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type ChatThread = z.infer<typeof ChatThreadSchema>
export type ChatThreadResult = z.infer<typeof ChatThreadResultSchema>
export type GetChatThreadInput = z.infer<typeof GetChatThreadInputSchema>
export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>
export type SendChatMessageResult = z.infer<typeof SendChatMessageResultSchema>
export type CopyAiResponseResult = z.infer<typeof CopyAiResponseResultSchema>
