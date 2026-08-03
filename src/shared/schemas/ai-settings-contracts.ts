import { z } from 'zod'

import { IpcErrorSchema } from './note-contracts'

export const AI_MODEL_IDS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] as const

export const AI_MODEL_OPTIONS = [
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol — En yüksek kalite' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra — Dengeli' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna — Ekonomik' },
] as const

export const AiModelSchema = z.enum(AI_MODEL_IDS)
export const AiCreativitySchema = z.enum(['precise', 'balanced', 'creative'])

export const AiPreferencesSchema = z
  .object({
    version: z.literal(1),
    model: AiModelSchema,
    maxOutputTokens: z.number().int().min(256).max(16_384),
    creativity: AiCreativitySchema,
    systemInstruction: z.string().trim().max(4_000),
    showUsage: z.boolean(),
  })
  .strict()

export const DEFAULT_AI_PREFERENCES = Object.freeze({
  version: 1 as const,
  model: 'gpt-5.6-terra' as const,
  maxOutputTokens: 2_048,
  creativity: 'balanced' as const,
  systemInstruction: '',
  showUsage: true,
})

export const AiSettingsViewSchema = AiPreferencesSchema.extend({
  apiKeyConfigured: z.boolean(),
  apiKeyMasked: z.literal('••••••••••••').nullable(),
  secureStorageAvailable: z.boolean(),
}).strict()

export const GetAiSettingsInputSchema = z.object({}).strict()

export const SaveAiSettingsInputSchema = z
  .object({
    preferences: AiPreferencesSchema,
    apiKey: z.string().trim().min(20).max(512).optional(),
    removeApiKey: z.boolean(),
  })
  .strict()
  .refine((input) => !(input.apiKey && input.removeApiKey), {
    message: 'API anahtarı aynı işlemde hem kaydedilip hem silinemez.',
  })

export const AiSettingsResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: AiSettingsViewSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export const AiConnectionFailureCodeSchema = z.enum([
  'MISSING_KEY',
  'INVALID_KEY',
  'NO_CONNECTION',
  'RATE_LIMIT',
  'INSUFFICIENT_QUOTA',
  'TIMEOUT',
  'SERVER_ERROR',
  'INVALID_RESPONSE',
  'MODEL_UNAVAILABLE',
  'SECURE_STORAGE_UNAVAILABLE',
])

export const AiConnectionTestSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('connected'),
      model: AiModelSchema,
      message: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      status: z.literal('failed'),
      code: AiConnectionFailureCodeSchema,
      message: z.string().min(1).max(300),
    })
    .strict(),
])

export const TestAiConnectionInputSchema = z.object({}).strict()

export const AiConnectionTestResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: AiConnectionTestSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type AiConnectionTest = z.infer<typeof AiConnectionTestSchema>
export type AiModel = z.infer<typeof AiModelSchema>
export type AiPreferences = z.infer<typeof AiPreferencesSchema>
export type AiSettingsResult = z.infer<typeof AiSettingsResultSchema>
export type AiSettingsView = z.infer<typeof AiSettingsViewSchema>
export type SaveAiSettingsInput = z.infer<typeof SaveAiSettingsInputSchema>
export type AiConnectionTestResult = z.infer<typeof AiConnectionTestResultSchema>
