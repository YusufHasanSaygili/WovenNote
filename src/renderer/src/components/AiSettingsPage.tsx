import { useEffect, useRef, useState } from 'react'

import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_PREFERENCES,
  type AiPreferences,
  type AiSettingsView,
} from '../../../shared/schemas/ai-settings-contracts'
import { useI18n } from '../i18n/i18n'

interface AiSettingsPageProps {
  readonly onBack: () => void
}

interface Feedback {
  readonly kind: 'success' | 'error'
  readonly message: string
}

function preferencesFromView(settings: AiSettingsView): AiPreferences {
  return {
    version: settings.version,
    model: settings.model,
    maxOutputTokens: settings.maxOutputTokens,
    creativity: settings.creativity,
    systemInstruction: settings.systemInstruction,
    showUsage: settings.showUsage,
  }
}

export function AiSettingsPage({ onBack }: AiSettingsPageProps): React.JSX.Element {
  const { locale, t } = useI18n()
  const [settings, setSettings] = useState<AiSettingsView | null>(null)
  const [preferences, setPreferences] = useState<AiPreferences>(DEFAULT_AI_PREFERENCES)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.wovenNote.settings
      .getAiSettings()
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setLoadError(result.error.message)
          return
        }
        setSettings(result.data)
        setPreferences(preferencesFromView(result.data))
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('AI ayarları yüklenemedi. Lütfen tekrar deneyin.'))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const save = async (removeApiKey: boolean): Promise<void> => {
    if (!settings) return
    setIsSaving(true)
    setFeedback(null)

    const enteredApiKey = apiKeyInputRef.current?.value.trim()
    const saveRequest = window.wovenNote.settings.saveAiSettings({
      preferences,
      apiKey: enteredApiKey || undefined,
      removeApiKey,
    })
    if (apiKeyInputRef.current) apiKeyInputRef.current.value = ''

    try {
      const result = await saveRequest
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message })
        return
      }
      setSettings(result.data)
      setPreferences(preferencesFromView(result.data))
      setFeedback({
        kind: 'success',
        message: removeApiKey
          ? t('API anahtarı güvenli depodan silindi.')
          : t('AI ayarları kaydedildi.'),
      })
    } catch {
      setFeedback({
        kind: 'error',
        message: t('AI ayarları kaydedilemedi. Lütfen tekrar deneyin.'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async (): Promise<void> => {
    setIsTesting(true)
    setFeedback(null)
    try {
      const result = await window.wovenNote.settings.testAiConnection()
      if (!result.ok) {
        setFeedback({ kind: 'error', message: result.error.message })
        return
      }
      setFeedback({
        kind: result.data.status === 'connected' ? 'success' : 'error',
        message: result.data.message,
      })
    } catch {
      setFeedback({ kind: 'error', message: t('Bağlantı testi tamamlanamadı.') })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <main className="settings-shell">
      <header className="settings-topbar">
        <button className="secondary-button" onClick={onBack} type="button">
          ← {t('Not panosuna dön')}
        </button>
        <div>
          <p className="eyebrow">{t('Ayarlar')}</p>
          <h1>{t('AI yapılandırması')}</h1>
        </div>
      </header>

      {loadError ? (
        <div className="state-panel error-state" role="alert">
          {loadError}
        </div>
      ) : null}

      {!settings && !loadError ? (
        <p className="state-panel">{t('AI ayarları yükleniyor…')}</p>
      ) : null}

      {settings ? (
        <form
          className="ai-settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save(false)
          }}
        >
          <section aria-labelledby="api-key-heading" className="settings-card">
            <div className="settings-card-heading">
              <div>
                <p className="eyebrow">{t('Güvenli bağlantı')}</p>
                <h2 id="api-key-heading">{t('OpenAI API anahtarı')}</h2>
              </div>
              <span className={`configuration-badge ${settings.apiKeyConfigured ? 'ready' : ''}`}>
                {settings.apiKeyConfigured ? t('Yapılandırıldı') : t('Yapılandırılmadı')}
              </span>
            </div>

            {!settings.secureStorageAvailable ? (
              <p className="settings-warning" role="alert">
                {t(
                  'İşletim sistemi güvenli anahtar saklama özelliği kullanılamıyor. Anahtar düz metin olarak kaydedilmeyecek.',
                )}
              </p>
            ) : null}

            <label htmlFor="masked-api-key">{t('Kayıtlı anahtar')}</label>
            <input
              id="masked-api-key"
              readOnly
              value={settings.apiKeyMasked ?? t('Kayıtlı anahtar yok')}
            />

            <label htmlFor="new-api-key">{t('Yeni API anahtarı')}</label>
            <input
              autoComplete="off"
              disabled={!settings.secureStorageAvailable || isSaving}
              id="new-api-key"
              maxLength={512}
              minLength={20}
              placeholder={
                settings.apiKeyConfigured ? t('Değiştirmek için yeni anahtarı girin') : 'sk-…'
              }
              ref={apiKeyInputRef}
              type="password"
            />
            <p className="field-hint">
              {t(
                'Anahtar yalnızca main process’e gönderilir ve işletim sistemi korumalı depoda şifrelenir; uygulama yedeklerine eklenmez.',
              )}
            </p>

            <div className="settings-inline-actions">
              <button
                className="secondary-button"
                disabled={!settings.apiKeyConfigured || isTesting || isSaving}
                onClick={() => void testConnection()}
                type="button"
              >
                {isTesting ? t('Bağlantı test ediliyor…') : t('Bağlantıyı test et')}
              </button>
              {settings.apiKeyConfigured ? (
                <button
                  className="danger-text-button"
                  disabled={isSaving || isTesting}
                  onClick={() => {
                    if (globalThis.confirm(t('Kayıtlı API anahtarı silinsin mi?'))) void save(true)
                  }}
                  type="button"
                >
                  {t('Anahtarı sil')}
                </button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="response-settings-heading" className="settings-card">
            <p className="eyebrow">{t('Yanıt tercihleri')}</p>
            <h2 id="response-settings-heading">{t('Model ve yanıt ayarları')}</h2>

            <div className="settings-fields-grid">
              <label>
                <span>{t('Model')}</span>
                <select
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      model: event.target.value as AiPreferences['model'],
                    }))
                  }
                  value={preferences.model}
                >
                  {AI_MODEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t('Maksimum yanıt uzunluğu')}</span>
                <select
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      maxOutputTokens: Number(event.target.value),
                    }))
                  }
                  value={preferences.maxOutputTokens}
                >
                  {[512, 1024, 2048, 4096, 8192, 16384].map((tokens) => (
                    <option key={tokens} value={tokens}>
                      {tokens.toLocaleString(locale)} token
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t('Yaratıcılık düzeyi')}</span>
                <select
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      creativity: event.target.value as AiPreferences['creativity'],
                    }))
                  }
                  value={preferences.creativity}
                >
                  <option value="precise">{t('Kesin')}</option>
                  <option value="balanced">{t('Dengeli')}</option>
                  <option value="creative">{t('Yaratıcı')}</option>
                </select>
              </label>
            </div>

            <label>
              <span>{t('İsteğe bağlı sistem talimatı')}</span>
              <textarea
                maxLength={4_000}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    systemInstruction: event.target.value,
                  }))
                }
                placeholder={t('Örneğin: Yanıtları kısa ve Türkçe ver.')}
                rows={5}
                value={preferences.systemInstruction}
              />
            </label>

            <label className="checkbox-field">
              <input
                checked={preferences.showUsage}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    showUsage: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>{t('Kullanım bilgisini AI yanıtlarında göster')}</span>
            </label>
          </section>

          {feedback ? (
            <p
              className={`settings-feedback ${feedback.kind}`}
              role={feedback.kind === 'error' ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          ) : null}

          <div className="settings-save-bar">
            <button className="primary-button" disabled={isSaving || isTesting} type="submit">
              {isSaving ? t('Kaydediliyor…') : t('AI ayarlarını kaydet')}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  )
}
