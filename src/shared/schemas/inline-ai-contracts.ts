import { z } from 'zod'

import { IpcErrorSchema } from './note-contracts'

export const INLINE_AI_ACTIONS = [
  'summarize',
  'correct',
  'rewrite',
  'shorten',
  'expand',
  'professionalize',
  'list',
  'translate',
  'explain',
] as const

export const INLINE_AI_ACTION_LABELS: Readonly<Record<(typeof INLINE_AI_ACTIONS)[number], string>> =
  {
    summarize: 'Özetle',
    correct: 'Düzelt',
    rewrite: 'Yeniden yaz',
    shorten: 'Kısalt',
    expand: 'Uzat',
    professionalize: 'Profesyonelleştir',
    list: 'Listeye dönüştür',
    translate: 'Çevir',
    explain: 'Açıkla',
  }

export const InlineAiActionSchema = z.enum(INLINE_AI_ACTIONS)

export const RunInlineAiActionInputSchema = z
  .object({
    noteId: z.string().min(1).max(100),
    requestId: z.uuid(),
    action: InlineAiActionSchema,
    selectedText: z.string().trim().min(1).max(8_000),
  })
  .strict()

export const RunInlineAiActionDataSchema = z
  .object({
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(100_000),
  })
  .strict()

export const RunInlineAiActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: RunInlineAiActionDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const CancelInlineAiActionInputSchema = z.object({ requestId: z.uuid() }).strict()
export const CancelInlineAiActionDataSchema = z.object({ cancelled: z.boolean() }).strict()
export const CancelInlineAiActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: CancelInlineAiActionDataSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type InlineAiAction = z.infer<typeof InlineAiActionSchema>
export type RunInlineAiActionInput = z.infer<typeof RunInlineAiActionInputSchema>
export type RunInlineAiActionResult = z.infer<typeof RunInlineAiActionResultSchema>
export type CancelInlineAiActionInput = z.infer<typeof CancelInlineAiActionInputSchema>
export type CancelInlineAiActionResult = z.infer<typeof CancelInlineAiActionResultSchema>
