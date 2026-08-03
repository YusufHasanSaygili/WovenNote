import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import { useI18n } from '../i18n/i18n'
import { MediaAlignmentControls, type MediaAlignment } from './MediaAlignmentControls'
import { youtubeEmbedUrl } from './youtube-url'

export function YouTubeVideoView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const videoId = String(node.attrs['videoId'])
  const alignment = node.attrs['alignment'] as MediaAlignment
  const source = youtubeEmbedUrl(videoId)

  return (
    <NodeViewWrapper
      className={`youtube-video alignment-${alignment} ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-youtube-video-id={videoId}
    >
      <MediaAlignmentControls
        alignment={alignment}
        onChange={(nextAlignment) => updateAttributes({ alignment: nextAlignment })}
      />
      <div className="youtube-video-frame">
        {source ? (
          <iframe
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            src={source}
            title={t('YouTube videosu')}
          />
        ) : (
          <div className="youtube-video-invalid" role="alert">
            {t('YouTube video bağlantısı geçersiz.')}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
