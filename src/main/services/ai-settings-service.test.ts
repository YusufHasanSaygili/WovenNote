// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_AI_PREFERENCES } from '../../shared/schemas/ai-settings-contracts'
import { closeDatabase, openDatabase } from '../database/database'
import { SettingsRepository } from '../repositories/settings-repository'
import type { SecretStore } from './encrypted-secret-store'
import { AiSettingsService } from './ai-settings-service'

let database: Database.Database | undefined

function fakeSecretStore(
  options: { available?: boolean; initial?: string | null } = {},
): SecretStore {
  let secret = options.initial ?? null
  const available = options.available ?? true
  return {
    isAvailable: () => available,
    has: () => available && secret !== null,
    read: () => secret,
    remove: () => {
      secret = null
    },
    write: (value) => {
      if (!available) throw new Error('Secure storage unavailable.')
      secret = value
    },
  }
}

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('AiSettingsService', () => {
  it('returns safe defaults without requiring AI configuration', () => {
    database = openDatabase(':memory:')
    const service = new AiSettingsService(new SettingsRepository(database), fakeSecretStore(), {
      test: vi.fn(),
    })

    expect(service.getSettings()).toEqual({
      ...DEFAULT_AI_PREFERENCES,
      apiKeyConfigured: false,
      apiKeyMasked: null,
      secureStorageAvailable: true,
    })
  })

  it('persists preferences while returning only a constant key mask', () => {
    database = openDatabase(':memory:')
    const repository = new SettingsRepository(database)
    const secretStore = fakeSecretStore()
    const service = new AiSettingsService(
      repository,
      secretStore,
      { test: vi.fn() },
      () => new Date('2026-07-28T20:00:00.000Z'),
    )

    const saved = service.saveSettings({
      preferences: {
        version: 1,
        model: 'gpt-5.6-luna',
        maxOutputTokens: 4_096,
        creativity: 'creative',
        systemInstruction: 'Kısa ve net yanıtla.',
        showUsage: false,
      },
      apiKey: 'sk-test-super-secret-value',
      removeApiKey: false,
    })

    expect(saved).toMatchObject({
      model: 'gpt-5.6-luna',
      apiKeyConfigured: true,
      apiKeyMasked: '••••••••••••',
    })
    expect(JSON.stringify(saved)).not.toContain('sk-test-super-secret-value')
    expect(repository.get('ai-preferences-v1')).not.toContain('sk-test-super-secret-value')
  })

  it('uses the secret only inside main process for connection tests', async () => {
    database = openDatabase(':memory:')
    const testConnection = vi.fn(async () => ({
      status: 'connected' as const,
      model: 'gpt-5.6-terra' as const,
      message: 'OpenAI bağlantısı doğrulandı.',
    }))
    const service = new AiSettingsService(
      new SettingsRepository(database),
      fakeSecretStore({ initial: 'sk-private-test-value' }),
      { test: testConnection },
    )

    await expect(service.testConnection()).resolves.toMatchObject({ status: 'connected' })
    expect(testConnection).toHaveBeenCalledWith('sk-private-test-value', 'gpt-5.6-terra')
  })

  it('reports missing keys and unavailable secure storage without throwing', async () => {
    database = openDatabase(':memory:')
    const repository = new SettingsRepository(database)

    await expect(
      new AiSettingsService(repository, fakeSecretStore(), { test: vi.fn() }).testConnection(),
    ).resolves.toMatchObject({ status: 'failed', code: 'MISSING_KEY' })
    await expect(
      new AiSettingsService(repository, fakeSecretStore({ available: false }), {
        test: vi.fn(),
      }).testConnection(),
    ).resolves.toMatchObject({ status: 'failed', code: 'SECURE_STORAGE_UNAVAILABLE' })
  })
})
