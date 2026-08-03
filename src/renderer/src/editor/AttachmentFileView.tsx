import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'

import type { Attachment } from '../../../shared/schemas/attachment-contracts'
import { useI18n } from '../i18n/i18n'

type MetadataState =
  | { readonly attachmentId: string; readonly status: 'loading' }
  | { readonly attachmentId: string; readonly status: 'ready'; readonly attachment: Attachment }
  | { readonly attachmentId: string; readonly status: 'missing' }

function formatFileSize(bytes: number, byteLabel: string): string {
  if (bytes < 1024) return `${bytes} ${byteLabel}`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentFileView({ node, selected }: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const attachmentId = String(node.attrs['attachmentId'])
  const [metadata, setMetadata] = useState<MetadataState>({ attachmentId, status: 'loading' })
  const [openError, setOpenError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const currentMetadata: MetadataState =
    metadata.attachmentId === attachmentId ? metadata : { attachmentId, status: 'loading' }

  useEffect(() => {
    let active = true
    void window.wovenNote.attachments
      .get({ attachmentId })
      .then((result) => {
        if (!active) return
        setMetadata(
          result.ok
            ? { attachmentId, status: 'ready', attachment: result.data }
            : { attachmentId, status: 'missing' },
        )
      })
      .catch(() => {
        if (active) setMetadata({ attachmentId, status: 'missing' })
      })
    return () => {
      active = false
    }
  }, [attachmentId])

  const openExternal = async (): Promise<void> => {
    setOpenError(null)
    setIsOpening(true)
    try {
      const result = await window.wovenNote.attachments.openExternal({ attachmentId })
      if (!result.ok) setOpenError(result.error.message)
    } catch {
      setOpenError(t('Dosya dış uygulamada açılamadı.'))
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <NodeViewWrapper
      className={`attachment-file ${selected ? 'is-selected' : ''}`}
      data-attachment-id={attachmentId}
    >
      <div className="attachment-file-icon" aria-hidden="true">
        {currentMetadata.status === 'ready' &&
        currentMetadata.attachment.mimeType === 'application/pdf'
          ? 'PDF'
          : '↗'}
      </div>
      <div className="attachment-file-copy">
        {currentMetadata.status === 'ready' ? (
          <>
            <strong>{currentMetadata.attachment.originalFileName}</strong>
            <span>
              {formatFileSize(currentMetadata.attachment.fileSize, t('bayt'))} ·{' '}
              {currentMetadata.attachment.mimeType}
            </span>
          </>
        ) : currentMetadata.status === 'missing' ? (
          <>
            <strong>{t('Dosya eki bulunamadı')}</strong>
            <span>{t('Dosya taşınmış veya silinmiş olabilir.')}</span>
          </>
        ) : (
          <>
            <strong>{t('Dosya eki yükleniyor…')}</strong>
            <span>{t('Metadata okunuyor.')}</span>
          </>
        )}
        {openError ? <small role="alert">{openError}</small> : null}
      </div>
      <button
        disabled={currentMetadata.status !== 'ready' || isOpening}
        onClick={() => void openExternal()}
        type="button"
      >
        {isOpening ? t('Açılıyor…') : t('Dış uygulamada aç')}
      </button>
    </NodeViewWrapper>
  )
}
