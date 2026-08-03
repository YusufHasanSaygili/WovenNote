import { z } from 'zod'

import { IpcErrorSchema } from './note-contracts'

export const DEFAULT_DETAIL_LAYOUT = Object.freeze({
  version: 1 as const,
  aiPanelPercentage: 30,
})

export const DetailLayoutSchema = z
  .object({
    version: z.literal(1),
    aiPanelPercentage: z.number().min(20).max(45),
  })
  .strict()

export const GetDetailLayoutInputSchema = z.object({}).strict()
export const SetDetailLayoutInputSchema = DetailLayoutSchema

export const DetailLayoutResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: DetailLayoutSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type DetailLayout = z.infer<typeof DetailLayoutSchema>
export type DetailLayoutResult = z.infer<typeof DetailLayoutResultSchema>
export type SetDetailLayoutInput = z.infer<typeof SetDetailLayoutInputSchema>
