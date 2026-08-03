// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { OpenAiResponseClient } from './openai-response-client'

const generationInput = {
  apiKey: 'sk-private-test-key',
  model: 'gpt-5.6-terra' as const,
  instructions: 'Yalnızca verilen notu kullan.',
  input: 'Açık not: Birinci not',
  maxOutputTokens: 2048,
}

describe('OpenAiResponseClient', () => {
  it('uses the Responses API without remote response storage and parses text usage', async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Notun özeti.' }] }],
        usage: { input_tokens: 20, output_tokens: 5 },
      }),
    )

    await expect(
      new OpenAiResponseClient(request).generate(generationInput, new AbortController().signal),
    ).resolves.toEqual({
      status: 'complete',
      text: 'Notun özeti.',
      inputTokens: 20,
      outputTokens: 5,
    })
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(request.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/responses')
    expect(body).toMatchObject({ model: 'gpt-5.6-terra', store: false })
    expect(JSON.stringify(body)).not.toContain('sk-private-test-key')
  })

  it('maps invalid keys and supports caller cancellation', async () => {
    const invalid = new OpenAiResponseClient(
      vi.fn<typeof fetch>(async () => new Response(null, { status: 401 })),
    )
    await expect(
      invalid.generate(generationInput, new AbortController().signal),
    ).resolves.toMatchObject({ status: 'error', message: expect.stringContaining('geçersiz') })

    const waitsForAbort = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const controller = new AbortController()
    const response = new OpenAiResponseClient(waitsForAbort).generate(
      generationInput,
      controller.signal,
    )
    controller.abort()

    await expect(response).resolves.toEqual({
      status: 'cancelled',
      message: 'AI isteği iptal edildi.',
    })
  })
})
