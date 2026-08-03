import { z } from 'zod'

import type { AiModel } from '../../shared/schemas/ai-settings-contracts'

const ResponseSchema = z
  .object({
    output: z.array(
      z
        .object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }).passthrough())
            .optional(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

const ErrorResponseSchema = z
  .object({ error: z.object({ code: z.string().nullable().optional() }).passthrough() })
  .passthrough()

export interface OpenAiGenerationInput {
  readonly apiKey: string
  readonly model: AiModel
  readonly instructions: string
  readonly input: string
  readonly maxOutputTokens: number
}

export type OpenAiGenerationResult =
  | Readonly<{
      status: 'complete'
      text: string
      inputTokens: number | null
      outputTokens: number | null
    }>
  | Readonly<{ status: 'error' | 'cancelled'; message: string }>

export class OpenAiResponseClient {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = 60_000,
  ) {}

  async generate(
    input: OpenAiGenerationInput,
    callerSignal: AbortSignal,
  ): Promise<OpenAiGenerationResult> {
    const requestController = new AbortController()
    let timedOut = false
    const cancelFromCaller = (): void => requestController.abort()
    callerSignal.addEventListener('abort', cancelFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      requestController.abort()
    }, this.timeoutMs)

    try {
      const response = await this.request('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          instructions: input.instructions,
          input: input.input,
          max_output_tokens: input.maxOutputTokens,
          store: false,
        }),
        signal: requestController.signal,
      })

      if (!response.ok) return this.mapHttpFailure(response)

      const body: unknown = await response.json().catch(() => null)
      const parsed = ResponseSchema.safeParse(body)
      if (!parsed.success) {
        return { status: 'error', message: 'OpenAI beklenmeyen bir yanıt döndürdü.' }
      }

      const text = parsed.data.output
        .flatMap((item) => item.content ?? [])
        .filter((content) => content.type === 'output_text')
        .map((content) => content.text ?? '')
        .join('')
        .trim()
      if (!text) return { status: 'error', message: 'OpenAI boş bir yanıt döndürdü.' }

      return {
        status: 'complete',
        text,
        inputTokens: parsed.data.usage?.input_tokens ?? null,
        outputTokens: parsed.data.usage?.output_tokens ?? null,
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (callerSignal.aborted) {
          return { status: 'cancelled', message: 'AI isteği iptal edildi.' }
        }
        if (timedOut) {
          return { status: 'error', message: 'AI isteği zaman aşımına uğradı.' }
        }
      }
      return { status: 'error', message: 'OpenAI bağlantısı kurulamadı.' }
    } finally {
      clearTimeout(timeout)
      callerSignal.removeEventListener('abort', cancelFromCaller)
    }
  }

  private async mapHttpFailure(response: Response): Promise<OpenAiGenerationResult> {
    if (response.status === 401 || response.status === 403) {
      return { status: 'error', message: 'API anahtarı geçersiz veya modele erişemiyor.' }
    }
    if (response.status === 404) {
      return { status: 'error', message: 'Seçilen OpenAI modeli kullanılamıyor.' }
    }
    if (response.status === 429) {
      const body: unknown = await response.json().catch(() => null)
      const parsed = ErrorResponseSchema.safeParse(body)
      return {
        status: 'error',
        message:
          parsed.success && parsed.data.error.code === 'insufficient_quota'
            ? 'OpenAI kullanım kotası veya kredisi yetersiz.'
            : 'OpenAI istek sınırına ulaşıldı. Biraz sonra deneyin.',
      }
    }
    if (response.status >= 500) {
      return { status: 'error', message: 'OpenAI hizmeti şu anda yanıt veremiyor.' }
    }
    return { status: 'error', message: 'AI isteği tamamlanamadı.' }
  }
}
