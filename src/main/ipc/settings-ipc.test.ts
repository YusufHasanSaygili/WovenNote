// @vitest-environment node

import type Database from 'better-sqlite3'
import type { IpcMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'

import { SETTINGS_CHANNELS } from '../../shared/ipc-channels'
import { DetailLayoutResultSchema } from '../../shared/schemas/detail-contracts'
import {
  AiConnectionTestResultSchema,
  AiSettingsResultSchema,
} from '../../shared/schemas/ai-settings-contracts'
import { closeDatabase, openDatabase } from '../database/database'
import { SettingsRepository } from '../repositories/settings-repository'
import { AiSettingsService } from '../services/ai-settings-service'
import type { SecretStore } from '../services/encrypted-secret-store'
import { SettingsService } from '../services/settings-service'
import { registerSettingsIpcHandlers } from './settings-ipc'

type Handler = (event: unknown, payload: unknown) => Promise<unknown>

class FakeIpcMain {
  readonly handlers = new Map<string, Handler>()

  handle(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
}

let database: Database.Database | undefined

function createAiService(repository: SettingsRepository): AiSettingsService {
  let secret: string | null = null
  const secretStore: SecretStore = {
    isAvailable: () => true,
    has: () => secret !== null,
    read: () => secret,
    remove: () => {
      secret = null
    },
    write: (value) => {
      secret = value
    },
  }
  return new AiSettingsService(repository, secretStore, {
    test: async (_apiKey, model) => ({
      status: 'connected',
      model,
      message: 'OpenAI bağlantısı doğrulandı.',
    }),
  })
}

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

describe('settings IPC contracts', () => {
  it('returns the 30/70 default and persists a validated panel ratio', async () => {
    database = openDatabase(':memory:')
    const repository = new SettingsRepository(database)
    const service = new SettingsService(repository, () => new Date('2026-07-28T16:00:00.000Z'))
    const ipc = new FakeIpcMain()
    registerSettingsIpcHandlers(ipc as unknown as IpcMain, service, createAiService(repository))
    const getLayout = ipc.handlers.get(SETTINGS_CHANNELS.getDetailLayout)!
    const setLayout = ipc.handlers.get(SETTINGS_CHANNELS.setDetailLayout)!

    expect(DetailLayoutResultSchema.parse(await getLayout({}, {}))).toEqual({
      ok: true,
      data: { version: 1, aiPanelPercentage: 30 },
    })
    expect(
      DetailLayoutResultSchema.parse(await setLayout({}, { version: 1, aiPanelPercentage: 36 })),
    ).toEqual({ ok: true, data: { version: 1, aiPanelPercentage: 36 } })
    expect(DetailLayoutResultSchema.parse(await getLayout({}, {}))).toEqual({
      ok: true,
      data: { version: 1, aiPanelPercentage: 36 },
    })
  })

  it('rejects out-of-range and over-posted layout settings', async () => {
    database = openDatabase(':memory:')
    const ipc = new FakeIpcMain()
    const repository = new SettingsRepository(database)
    registerSettingsIpcHandlers(
      ipc as unknown as IpcMain,
      new SettingsService(repository),
      createAiService(repository),
    )
    const setLayout = ipc.handlers.get(SETTINGS_CHANNELS.setDetailLayout)!

    const outOfRange = DetailLayoutResultSchema.parse(
      await setLayout({}, { version: 1, aiPanelPercentage: 10 }),
    )
    const overPosted = DetailLayoutResultSchema.parse(
      await setLayout({}, { version: 1, aiPanelPercentage: 30, secret: true }),
    )

    expect(outOfRange).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(overPosted).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('saves AI settings without returning the real API key and tests the saved secret', async () => {
    database = openDatabase(':memory:')
    const repository = new SettingsRepository(database)
    const ipc = new FakeIpcMain()
    registerSettingsIpcHandlers(
      ipc as unknown as IpcMain,
      new SettingsService(repository),
      createAiService(repository),
    )
    const saveSettings = ipc.handlers.get(SETTINGS_CHANNELS.saveAiSettings)!
    const testConnection = ipc.handlers.get(SETTINGS_CHANNELS.testAiConnection)!

    const saved = AiSettingsResultSchema.parse(
      await saveSettings(
        {},
        {
          preferences: {
            version: 1,
            model: 'gpt-5.6-luna',
            maxOutputTokens: 1024,
            creativity: 'precise',
            systemInstruction: '',
            showUsage: true,
          },
          apiKey: 'sk-contract-super-secret-value',
          removeApiKey: false,
        },
      ),
    )

    expect(saved).toMatchObject({
      ok: true,
      data: { apiKeyConfigured: true, apiKeyMasked: '••••••••••••' },
    })
    expect(JSON.stringify(saved)).not.toContain('sk-contract-super-secret-value')
    expect(AiConnectionTestResultSchema.parse(await testConnection({}, {}))).toMatchObject({
      ok: true,
      data: { status: 'connected', model: 'gpt-5.6-luna' },
    })
  })

  it('rejects over-posted AI settings before they reach the service', async () => {
    database = openDatabase(':memory:')
    const repository = new SettingsRepository(database)
    const ipc = new FakeIpcMain()
    registerSettingsIpcHandlers(
      ipc as unknown as IpcMain,
      new SettingsService(repository),
      createAiService(repository),
    )

    const result = AiSettingsResultSchema.parse(
      await ipc.handlers.get(SETTINGS_CHANNELS.saveAiSettings)!(
        {},
        {
          preferences: {
            version: 1,
            model: 'gpt-5.6-terra',
            maxOutputTokens: 2048,
            creativity: 'balanced',
            systemInstruction: '',
            showUsage: true,
            apiKey: 'must-not-be-nested-here',
          },
          removeApiKey: false,
        },
      ),
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })
})
