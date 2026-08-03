// @vitest-environment node

import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'

import { createValidatedHandler, isIpcPayloadWithinLimits } from './validated-handler'

const ResultSchema = z.discriminatedUnion('ok', [
  z
    .object({ ok: z.literal(true), data: z.object({ accepted: z.literal(true) }).strict() })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum(['VALIDATION_ERROR', 'OPERATION_FAILED']),
          message: z.string(),
        })
        .strict(),
    })
    .strict(),
])

describe('validated IPC handler payload budget', () => {
  it('accepts a normal strict payload and calls the operation once', async () => {
    const operation = vi.fn(() => ({ accepted: true as const }))
    const handler = createValidatedHandler({
      inputSchema: z.object({ text: z.string().max(100) }).strict(),
      resultSchema: ResultSchema,
      operation,
    })

    await expect(handler({}, { text: 'güvenli içerik' })).resolves.toEqual({
      ok: true,
      data: { accepted: true },
    })
    expect(operation).toHaveBeenCalledOnce()
  })

  it('rejects oversized, excessively deep and cyclic payloads before schema parsing', async () => {
    const operation = vi.fn(() => ({ accepted: true as const }))
    const handler = createValidatedHandler({
      inputSchema: z.object({ value: z.unknown() }).strict(),
      resultSchema: ResultSchema,
      operation,
      validationErrorMessage: 'IPC payload sınırı aşıldı.',
    })
    const deepRoot: Record<string, unknown> = {}
    let current = deepRoot
    for (let depth = 0; depth < 70; depth += 1) {
      const next: Record<string, unknown> = {}
      current['next'] = next
      current = next
    }
    const cyclic: Record<string, unknown> = {}
    cyclic['self'] = cyclic

    expect(isIpcPayloadWithinLimits({ value: 'x'.repeat(8 * 1024 * 1024 + 1) })).toBe(false)
    expect(isIpcPayloadWithinLimits({ value: deepRoot })).toBe(false)
    expect(isIpcPayloadWithinLimits({ value: cyclic })).toBe(false)
    await expect(handler({}, { value: deepRoot })).resolves.toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'IPC payload sınırı aşıldı.' },
    })
    expect(operation).not.toHaveBeenCalled()
  })
})
