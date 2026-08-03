import type { z } from 'zod'

import type { IpcErrorSchema } from '../../shared/schemas/note-contracts'

type IpcError = z.infer<typeof IpcErrorSchema>
type IpcFailure = Readonly<{ ok: false; error: IpcError }>

const MAX_IPC_PAYLOAD_DEPTH = 64
const MAX_IPC_PAYLOAD_NODES = 100_000
const MAX_IPC_PAYLOAD_TEXT_UNITS = 8 * 1024 * 1024

function failure(code: IpcError['code'], message: string): IpcFailure {
  return {
    ok: false,
    error: { code, message },
  }
}

function isPlainIpcContainer(value: object): boolean {
  if (Array.isArray(value)) return true
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function isIpcPayloadWithinLimits(payload: unknown): boolean {
  const seen = new WeakSet<object>()
  const pending: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value: payload, depth: 0 },
  ]
  let nodeCount = 0
  let textUnits = 0

  while (pending.length > 0) {
    const current = pending.pop()!
    nodeCount += 1
    if (nodeCount > MAX_IPC_PAYLOAD_NODES) return false

    if (typeof current.value === 'string') {
      textUnits += current.value.length
      if (textUnits > MAX_IPC_PAYLOAD_TEXT_UNITS) return false
      continue
    }
    if (current.value === null || typeof current.value !== 'object') continue
    if (current.depth >= MAX_IPC_PAYLOAD_DEPTH || !isPlainIpcContainer(current.value)) return false
    if (seen.has(current.value)) return false
    seen.add(current.value)

    const entries = Array.isArray(current.value)
      ? current.value.map((value) => ['', value] as const)
      : Object.entries(current.value)
    for (const [key, value] of entries) {
      textUnits += key.length
      if (textUnits > MAX_IPC_PAYLOAD_TEXT_UNITS) return false
      pending.push({ value, depth: current.depth + 1 })
    }
  }

  return true
}

export function createValidatedHandler<TInput, TResult>(options: {
  readonly inputSchema: z.ZodType<TInput>
  readonly operationErrorMessage?: (error: unknown) => string
  readonly resultSchema: z.ZodType<TResult>
  readonly operation: (input: TInput) => unknown | Promise<unknown>
  readonly validationErrorMessage?: string
}): (_event: unknown, payload: unknown) => Promise<TResult> {
  return async (_event, payload) => {
    const input = isIpcPayloadWithinLimits(payload)
      ? options.inputSchema.safeParse(payload)
      : { success: false as const }

    if (!input.success) {
      return options.resultSchema.parse(
        failure(
          'VALIDATION_ERROR',
          options.validationErrorMessage ?? 'Gönderilen not bilgileri geçersiz.',
        ),
      )
    }

    try {
      const data = await options.operation(input.data)
      return options.resultSchema.parse({ ok: true, data })
    } catch (error) {
      return options.resultSchema.parse(
        failure(
          'OPERATION_FAILED',
          options.operationErrorMessage?.(error) ??
            'Not işlemi tamamlanamadı. Lütfen tekrar deneyin.',
        ),
      )
    }
  }
}
