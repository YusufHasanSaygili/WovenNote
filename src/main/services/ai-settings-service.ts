import {
  AiPreferencesSchema,
  DEFAULT_AI_PREFERENCES,
  SaveAiSettingsInputSchema,
  type AiConnectionTest,
  type AiModel,
  type AiPreferences,
  type AiSettingsView,
  type SaveAiSettingsInput,
} from '../../shared/schemas/ai-settings-contracts'
import type { SettingsRepository } from '../repositories/settings-repository'
import type { SecretStore } from './encrypted-secret-store'

const AI_PREFERENCES_KEY = 'ai-preferences-v1'
const MASKED_API_KEY = '••••••••••••' as const

interface ConnectionTester {
  readonly test: (apiKey: string, model: AiModel) => Promise<AiConnectionTest>
}

export type AiRequestConfigurationResult =
  | Readonly<{ ok: true; apiKey: string; preferences: AiPreferences }>
  | Readonly<{ ok: false; message: string }>

export class AiSettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly secretStore: SecretStore,
    private readonly connectionTester: ConnectionTester,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getSettings(): AiSettingsView {
    const preferences = this.getPreferences()
    const secureStorageAvailable = this.secretStore.isAvailable()
    const apiKeyConfigured = secureStorageAvailable && this.secretStore.has()

    return {
      ...preferences,
      apiKeyConfigured,
      apiKeyMasked: apiKeyConfigured ? MASKED_API_KEY : null,
      secureStorageAvailable,
    }
  }

  saveSettings(input: SaveAiSettingsInput): AiSettingsView {
    const validated = SaveAiSettingsInputSchema.parse(input)

    if (validated.apiKey) this.secretStore.write(validated.apiKey)
    else if (validated.removeApiKey) this.secretStore.remove()

    this.repository.set(
      AI_PREFERENCES_KEY,
      JSON.stringify(validated.preferences),
      this.now().toISOString(),
    )
    return this.getSettings()
  }

  async testConnection(): Promise<AiConnectionTest> {
    if (!this.secretStore.isAvailable()) {
      return {
        status: 'failed',
        code: 'SECURE_STORAGE_UNAVAILABLE',
        message: 'İşletim sistemi güvenli anahtar saklama özelliği kullanılamıyor.',
      }
    }

    let apiKey: string | null
    try {
      apiKey = this.secretStore.read()
    } catch {
      return {
        status: 'failed',
        code: 'SECURE_STORAGE_UNAVAILABLE',
        message: 'Kayıtlı API anahtarı güvenli depodan okunamadı.',
      }
    }

    if (!apiKey) {
      return {
        status: 'failed',
        code: 'MISSING_KEY',
        message: 'Bağlantıyı test etmek için önce bir API anahtarı kaydedin.',
      }
    }

    return this.connectionTester.test(apiKey, this.getPreferences().model)
  }

  getRequestConfiguration(): AiRequestConfigurationResult {
    if (!this.secretStore.isAvailable()) {
      return {
        ok: false,
        message: 'İşletim sistemi güvenli anahtar saklama özelliği kullanılamıyor.',
      }
    }

    try {
      const apiKey = this.secretStore.read()
      if (!apiKey)
        return { ok: false, message: 'AI kullanmak için önce bir API anahtarı kaydedin.' }
      return { ok: true, apiKey, preferences: this.getPreferences() }
    } catch {
      return { ok: false, message: 'Kayıtlı API anahtarı güvenli depodan okunamadı.' }
    }
  }

  private getPreferences(): AiPreferences {
    const stored = this.repository.get(AI_PREFERENCES_KEY)
    if (!stored) return DEFAULT_AI_PREFERENCES

    try {
      const parsed = AiPreferencesSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : DEFAULT_AI_PREFERENCES
    } catch {
      return DEFAULT_AI_PREFERENCES
    }
  }
}
