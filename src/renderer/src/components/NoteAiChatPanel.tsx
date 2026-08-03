import { useEffect, useRef, useState } from 'react'

import type { ChatMessage } from '../../../shared/schemas/ai-chat-contracts'
import type { Note } from '../../../shared/schemas/note-contracts'
import { useI18n } from '../i18n/i18n'

interface NoteAiChatPanelProps {
  readonly noteId: string
  readonly noteTitle: string
  readonly onBeforeSend: () => Promise<void>
  readonly onNoteCreated: (note: Note) => void
  readonly onResponseAppended: (note: Note) => void
}

export function NoteAiChatPanel({
  noteId,
  noteTitle,
  onBeforeSend,
  onNoteCreated,
  onResponseAppended,
}: NoteAiChatPanelProps): React.JSX.Element {
  const { t } = useI18n()
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoadingThread, setIsLoadingThread] = useState(true)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [contextWasTruncated, setContextWasTruncated] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const activeRequestRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.wovenNote.settings
      .getAiSettings()
      .then(async (settingsResult) => {
        if (cancelled) return
        if (!settingsResult.ok) {
          setError(settingsResult.error.message)
          return
        }

        setIsConfigured(settingsResult.data.apiKeyConfigured)
        if (!settingsResult.data.apiKeyConfigured) return

        const threadResult = await window.wovenNote.ai.getThread({ id: noteId })
        if (cancelled) return
        if (!threadResult.ok) {
          setError(threadResult.error.message)
          return
        }
        setMessages(threadResult.data.messages)
      })
      .catch(() => {
        if (!cancelled) setError(t('AI sohbeti yüklenemedi.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingThread(false)
      })

    return () => {
      cancelled = true
      const requestId = activeRequestRef.current
      if (requestId) void window.wovenNote.ai.cancelRequest({ requestId })
    }
  }, [noteId, t])

  const sendQuestion = async (): Promise<void> => {
    const message = question.trim()
    if (!message || activeRequestRef.current) return

    setError(null)
    setContextWasTruncated(false)
    try {
      await onBeforeSend()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t('Not kaydedilemediği için AI isteği gönderilmedi.'),
      )
      return
    }

    const requestId = globalThis.crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const optimisticUserId = globalThis.crypto.randomUUID()
    const optimisticAssistantId = globalThis.crypto.randomUUID()
    setQuestion('')
    setMessages((current) => [
      ...current,
      {
        id: optimisticUserId,
        sessionId: requestId,
        role: 'user',
        content: message,
        status: 'complete',
        createdAt: timestamp,
      },
      {
        id: optimisticAssistantId,
        sessionId: requestId,
        role: 'assistant',
        content: t('Yanıt hazırlanıyor…'),
        status: 'pending',
        createdAt: timestamp,
      },
    ])
    activeRequestRef.current = requestId
    setActiveRequestId(requestId)

    try {
      const result = await window.wovenNote.ai.sendMessage({ noteId, requestId, message })
      if (!result.ok) {
        setMessages((current) =>
          current.map((item) =>
            item.id === optimisticAssistantId
              ? { ...item, content: result.error.message, status: 'error' }
              : item,
          ),
        )
        return
      }
      setMessages(result.data.thread.messages)
      setContextWasTruncated(result.data.contextTruncated)
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === optimisticAssistantId
            ? { ...item, content: t('AI isteği tamamlanamadı.'), status: 'error' }
            : item,
        ),
      )
    } finally {
      activeRequestRef.current = null
      setActiveRequestId(null)
    }
  }

  const cancelRequest = async (): Promise<void> => {
    const requestId = activeRequestRef.current
    if (!requestId) return
    try {
      const result = await window.wovenNote.ai.cancelRequest({ requestId })
      if (!result.ok || !result.data.cancelled) {
        setError(result.ok ? t('Aktif AI isteği bulunamadı.') : result.error.message)
      }
    } catch {
      setError(t('AI isteği iptal edilemedi.'))
    }
  }

  const copyResponse = async (messageId: string): Promise<void> => {
    const actionKey = `${messageId}:copy`
    setActiveAction(actionKey)
    setActionFeedback(null)
    try {
      const result = await window.wovenNote.ai.copyResponse({ noteId, messageId })
      if (!result.ok) throw new Error(result.error.message)
      setActionFeedback(t('AI yanıtı panoya kopyalandı.'))
    } catch (actionError) {
      setActionFeedback(
        actionError instanceof Error ? actionError.message : t('AI yanıtı kopyalanamadı.'),
      )
    } finally {
      setActiveAction(null)
    }
  }

  const performResponseNoteAction = async (
    messageId: string,
    action: 'append' | 'create',
  ): Promise<void> => {
    const actionKey = `${messageId}:${action}`
    setActiveAction(actionKey)
    setActionFeedback(null)
    try {
      if (action === 'append') await onBeforeSend()
      const result =
        action === 'append'
          ? await window.wovenNote.ai.appendResponseToNote({ noteId, messageId })
          : await window.wovenNote.ai.createNoteFromResponse({ noteId, messageId })
      if (!result.ok) throw new Error(result.error.message)

      if (action === 'append') {
        onResponseAppended(result.data)
        setActionFeedback(t('AI yanıtı açık notun sonuna eklendi.'))
      } else {
        onNoteCreated(result.data)
        setActionFeedback(t('“{{title}}” oluşturuldu.', { title: result.data.title }))
      }
    } catch (actionError) {
      setActionFeedback(
        actionError instanceof Error ? actionError.message : t('AI yanıtı kullanılamadı.'),
      )
    } finally {
      setActiveAction(null)
    }
  }

  if (isLoadingThread) {
    return <p className="ai-chat-state">{t('AI paneli hazırlanıyor…')}</p>
  }

  if (!isConfigured) {
    return (
      <div className="ai-empty-state">
        <p className="eyebrow">{t('Nota özel alan')}</p>
        <h2 id="ai-panel-title">{t('AI henüz yapılandırılmadı')}</h2>
        <p>{t('AI sohbetini kullanmak için AI ayarlarında güvenli bir API anahtarı kaydedin.')}</p>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="ai-chat">
      <header className="ai-chat-heading">
        <div>
          <p className="eyebrow">{t('Nota özel sohbet')}</p>
          <h2 id="ai-panel-title">{t('AI ile konuş')}</h2>
        </div>
        <p>
          {t('Gönderilecek bağlam:')} <strong>{noteTitle}</strong>
        </p>
      </header>

      <div className="ai-chat-messages" aria-live="polite" aria-label={t('AI sohbet mesajları')}>
        {messages.length === 0 ? (
          <div className="ai-empty-state compact">
            <h3>{t('Bu not hakkında ne öğrenmek istersin?')}</h3>
            <p>{t('Özet, öncelikler, eksik görevler veya yeniden yazım isteyebilirsin.')}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isActionable = message.role === 'assistant' && message.status === 'complete'
            return (
              <article className={`ai-message ${message.role} ${message.status}`} key={message.id}>
                <span>{message.role === 'user' ? t('Sen') : 'AI'}</span>
                <p>{message.content}</p>
                {isActionable ? (
                  <div className="ai-response-actions" aria-label={t('AI yanıtı eylemleri')}>
                    <button
                      disabled={activeAction !== null}
                      onClick={() => void copyResponse(message.id)}
                      type="button"
                    >
                      {activeAction === `${message.id}:copy`
                        ? t('Kopyalanıyor…')
                        : t('Yanıtı kopyala')}
                    </button>
                    <button
                      disabled={activeAction !== null}
                      onClick={() => void performResponseNoteAction(message.id, 'append')}
                      type="button"
                    >
                      {activeAction === `${message.id}:append` ? t('Ekleniyor…') : t('Nota ekle')}
                    </button>
                    <button
                      disabled={activeAction !== null}
                      onClick={() => void performResponseNoteAction(message.id, 'create')}
                      type="button"
                    >
                      {activeAction === `${message.id}:create`
                        ? t('Oluşturuluyor…')
                        : t('Yeni not oluştur')}
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>

      {actionFeedback ? (
        <p className="ai-action-feedback" role="status" aria-live="polite">
          {actionFeedback}
        </p>
      ) : null}

      {contextWasTruncated ? (
        <p className="ai-context-notice" role="status">
          {t('Uzun not bağlamı 40.000 karakterle sınırlandı.')}
        </p>
      ) : null}
      {error ? (
        <p className="ai-chat-error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="ai-chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void sendQuestion()
        }}
      >
        <label className="sr-only" htmlFor="ai-chat-question">
          {t("AI'a sor")}
        </label>
        <textarea
          disabled={activeRequestId !== null}
          id="ai-chat-question"
          maxLength={8_000}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendQuestion()
            }
          }}
          placeholder={t('Bu not hakkında sor…')}
          rows={3}
          value={question}
        />
        {activeRequestId ? (
          <button className="secondary-button" onClick={() => void cancelRequest()} type="button">
            {t('İsteği iptal et')}
          </button>
        ) : (
          <button className="primary-button" disabled={!question.trim()} type="submit">
            {t('Gönder')}
          </button>
        )}
      </form>
    </div>
  )
}
