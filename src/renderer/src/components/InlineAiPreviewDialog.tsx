import {
  INLINE_AI_ACTION_LABELS,
  type InlineAiAction,
} from '../../../shared/schemas/inline-ai-contracts'
import { useModalFocusTrap } from '../hooks/useModalFocusTrap'

interface InlineAiPreviewDialogProps {
  readonly action: InlineAiAction
  readonly error: string | null
  readonly isLoading: boolean
  readonly onAccept: () => void
  readonly onCancel: () => void
  readonly onRegenerate: () => void
  readonly originalText: string
  readonly resultText: string | null
}

export function InlineAiPreviewDialog({
  action,
  error,
  isLoading,
  onAccept,
  onCancel,
  onRegenerate,
  originalText,
  resultText,
}: InlineAiPreviewDialogProps): React.JSX.Element {
  const { dialogRef, onKeyDown: handleModalKeyDown } = useModalFocusTrap(onCancel)
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="inline-ai-preview-title"
        aria-modal="true"
        className="inline-ai-preview-dialog"
        role="dialog"
        onKeyDown={handleModalKeyDown}
        ref={dialogRef}
      >
        <header className="dialog-heading">
          <p className="eyebrow">Seçili metin AI işlemi</p>
          <h2 id="inline-ai-preview-title">{INLINE_AI_ACTION_LABELS[action]} önizlemesi</h2>
          <p>Not ancak “Kabul et” seçildiğinde değişir.</p>
        </header>

        <div className="inline-ai-diff" aria-label="Özgün ve önerilen metin karşılaştırması">
          <section>
            <h3>Özgün metin</h3>
            <pre>{originalText}</pre>
          </section>
          <section>
            <h3>AI önerisi</h3>
            {isLoading ? <p role="status">Yeni öneri hazırlanıyor…</p> : null}
            {!isLoading && resultText ? <pre>{resultText}</pre> : null}
            {!isLoading && !resultText && !error ? <p>Henüz öneri yok.</p> : null}
          </section>
        </div>

        {error ? <p role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            İptal
          </button>
          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={onRegenerate}
            type="button"
          >
            Yeniden oluştur
          </button>
          <button
            className="primary-button"
            disabled={isLoading || !resultText || Boolean(error)}
            onClick={onAccept}
            type="button"
          >
            Kabul et
          </button>
        </div>
      </section>
    </div>
  )
}
