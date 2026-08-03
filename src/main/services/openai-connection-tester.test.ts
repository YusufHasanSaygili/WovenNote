// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { OpenAiConnectionTester } from './openai-connection-tester'

describe('OpenAiConnectionTester', () => {
  it('distinguishes a valid model connection from an invalid API key', async () => {
    const validRequest = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'gpt-5.6-terra', object: 'model', owned_by: 'openai' }),
    )
    const invalidRequest = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { code: 'invalid_api_key' } }, { status: 401 }),
    )

    await expect(
      new OpenAiConnectionTester(validRequest).test('sk-valid-test-value', 'gpt-5.6-terra'),
    ).resolves.toEqual({
      status: 'connected',
      model: 'gpt-5.6-terra',
      message: 'OpenAI bağlantısı doğrulandı.',
    })
    await expect(
      new OpenAiConnectionTester(invalidRequest).test('sk-invalid-test-value', 'gpt-5.6-terra'),
    ).resolves.toMatchObject({ status: 'failed', code: 'INVALID_KEY' })
    expect(validRequest.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer sk-valid-test-value',
    })
  })

  it('maps quota, server, network, and malformed-response errors', async () => {
    const quota = new OpenAiConnectionTester(
      vi.fn<typeof fetch>(async () =>
        Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }),
      ),
    )
    const server = new OpenAiConnectionTester(
      vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
    )
    const network = new OpenAiConnectionTester(
      vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('offline'))),
    )
    const malformed = new OpenAiConnectionTester(
      vi.fn<typeof fetch>(async () => Response.json({ object: 'unexpected' })),
    )

    await expect(quota.test('sk-test-value-long-enough', 'gpt-5.6-luna')).resolves.toMatchObject({
      status: 'failed',
      code: 'INSUFFICIENT_QUOTA',
    })
    await expect(server.test('sk-test-value-long-enough', 'gpt-5.6-luna')).resolves.toMatchObject({
      status: 'failed',
      code: 'SERVER_ERROR',
    })
    await expect(network.test('sk-test-value-long-enough', 'gpt-5.6-luna')).resolves.toMatchObject({
      status: 'failed',
      code: 'NO_CONNECTION',
    })
    await expect(
      malformed.test('sk-test-value-long-enough', 'gpt-5.6-luna'),
    ).resolves.toMatchObject({ status: 'failed', code: 'INVALID_RESPONSE' })
  })

  it('aborts a connection test that exceeds its timeout', async () => {
    const neverResponds = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )

    await expect(
      new OpenAiConnectionTester(neverResponds, 5).test(
        'sk-test-value-long-enough',
        'gpt-5.6-terra',
      ),
    ).resolves.toMatchObject({ status: 'failed', code: 'TIMEOUT' })
  })
})
