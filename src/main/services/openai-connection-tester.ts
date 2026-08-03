import { z } from 'zod'

import type { AiConnectionTest, AiModel } from '../../shared/schemas/ai-settings-contracts'

const ModelResponseSchema = z
  .object({ id: z.string().min(1), object: z.literal('model') })
  .passthrough()

const ErrorResponseSchema = z
  .object({ error: z.object({ code: z.string().nullable().optional() }).passthrough() })
  .passthrough()

export class OpenAiConnectionTester {
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async test(apiKey: string, model: AiModel): Promise<AiConnectionTest> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.request(
        `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        },
      )

      if (response.ok) {
        const body: unknown = await response.json().catch(() => null)
        const parsed = ModelResponseSchema.safeParse(body)
        if (!parsed.success || parsed.data.id !== model) {
          return this.failure('INVALID_RESPONSE', 'OpenAI beklenmeyen bir yanıt döndürdü.')
        }
        return { status: 'connected', model, message: 'OpenAI bağlantısı doğrulandı.' }
      }

      if (response.status === 401 || response.status === 403) {
        return this.failure('INVALID_KEY', 'API anahtarı geçersiz veya bu modele erişemiyor.')
      }
      if (response.status === 404) {
        return this.failure('MODEL_UNAVAILABLE', 'Seçilen model bu API anahtarıyla kullanılamıyor.')
      }
      if (response.status === 429) {
        const body: unknown = await response.json().catch(() => null)
        const parsed = ErrorResponseSchema.safeParse(body)
        if (parsed.success && parsed.data.error.code === 'insufficient_quota') {
          return this.failure('INSUFFICIENT_QUOTA', 'OpenAI kullanım kotası veya kredisi yetersiz.')
        }
        return this.failure('RATE_LIMIT', 'OpenAI istek sınırına ulaşıldı. Biraz sonra deneyin.')
      }
      if (response.status >= 500) {
        return this.failure('SERVER_ERROR', 'OpenAI hizmeti şu anda yanıt veremiyor.')
      }

      return this.failure('INVALID_RESPONSE', 'OpenAI bağlantısı doğrulanamadı.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return this.failure('TIMEOUT', 'OpenAI bağlantı testi zaman aşımına uğradı.')
      }
      return this.failure('NO_CONNECTION', 'İnternet bağlantısı kurulamadı.')
    } finally {
      clearTimeout(timeout)
    }
  }

  private failure(code: Extract<AiConnectionTest, { status: 'failed' }>['code'], message: string) {
    return { status: 'failed' as const, code, message }
  }
}
