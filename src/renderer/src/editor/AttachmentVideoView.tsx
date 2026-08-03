import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

import { useI18n } from '../i18n/i18n'
import { attachmentContentUrl } from './attachment-url'
import { MediaAlignmentControls, type MediaAlignment } from './MediaAlignmentControls'

export function AttachmentVideoView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const attachmentId = String(node.attrs['attachmentId'])
  const alignment = node.attrs['alignment'] as MediaAlignment
  const [brokenAttachmentId, setBrokenAttachmentId] = useState<string | null>(null)
  const isBroken = brokenAttachmentId === attachmentId

  return (
    <NodeViewWrapper
      className={`attachment-video alignment-${alignment} ${selected ? 'is-selected' : ''}`}
      data-attachment-id={attachmentId}
    >
      <MediaAlignmentControls
        alignment={alignment}
        onChange={(nextAlignment) => updateAttributes({ alignment: nextAlignment })}
      />
      <div className="attachment-video-frame">
        {isBroken ? (
          <div className="attachment-media-missing" role="status">
            <span aria-hidden="true">▶</span>
            <strong>{t('Video yüklenemedi')}</strong>
            <small>{t('Dosya taşınmış, silinmiş veya oynatılamıyor olabilir.')}</small>
          </div>
        ) : (
          <video
            aria-label={t('Yerel video')}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onError={() => setBrokenAttachmentId(attachmentId)}
            playsInline
            preload="metadata"
            src={attachmentContentUrl(attachmentId)}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}
