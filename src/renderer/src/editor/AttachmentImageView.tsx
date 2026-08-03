import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

import { useI18n } from '../i18n/i18n'
import { attachmentContentUrl } from './attachment-url'

type ImageAlignment = 'left' | 'center' | 'right'
type ImageWidth = 25 | 50 | 75 | 100

interface AttachmentImageAttributes {
  readonly alignment: ImageAlignment
  readonly alt: string
  readonly attachmentId: string
  readonly width: ImageWidth
}

const IMAGE_WIDTHS: readonly ImageWidth[] = [25, 50, 75, 100]

export function AttachmentImageView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps): React.JSX.Element {
  const { t } = useI18n()
  const attributes = node.attrs as AttachmentImageAttributes
  const [brokenAttachmentId, setBrokenAttachmentId] = useState<string | null>(null)
  const isBroken = brokenAttachmentId === attributes.attachmentId

  const resize = (direction: -1 | 1): void => {
    const currentIndex = IMAGE_WIDTHS.indexOf(attributes.width)
    const nextIndex = Math.max(0, Math.min(IMAGE_WIDTHS.length - 1, currentIndex + direction))
    updateAttributes({ width: IMAGE_WIDTHS[nextIndex] })
  }

  return (
    <NodeViewWrapper
      as="figure"
      className={`attachment-image alignment-${attributes.alignment} width-${attributes.width} ${selected ? 'is-selected' : ''}`}
      data-attachment-id={attributes.attachmentId}
    >
      {isBroken ? (
        <div
          className="attachment-image-broken"
          role="img"
          aria-label={attributes.alt || t('Görsel')}
        >
          <span aria-hidden="true">▧</span>
          <strong>{t('Görsel yüklenemedi')}</strong>
          <small>{t('Dosya taşınmış veya kullanılamıyor olabilir.')}</small>
        </div>
      ) : (
        <img
          alt={attributes.alt}
          draggable="false"
          onError={() => setBrokenAttachmentId(attributes.attachmentId)}
          src={attachmentContentUrl(attributes.attachmentId)}
        />
      )}
      <div className="attachment-image-controls" contentEditable={false}>
        <div className="attachment-image-control-row" role="group" aria-label={t('Görsel boyutu')}>
          <button
            aria-label={t('Görseli küçült')}
            disabled={attributes.width === IMAGE_WIDTHS[0]}
            onClick={() => resize(-1)}
            type="button"
          >
            −
          </button>
          <span>{attributes.width}%</span>
          <button
            aria-label={t('Görseli büyüt')}
            disabled={attributes.width === IMAGE_WIDTHS.at(-1)}
            onClick={() => resize(1)}
            type="button"
          >
            +
          </button>
          <button
            aria-pressed={attributes.width === 100}
            onClick={() => updateAttributes({ width: 100 })}
            type="button"
          >
            {t('Tam genişlik')}
          </button>
        </div>
        <div
          className="attachment-image-control-row"
          role="group"
          aria-label={t('Görsel hizalama')}
        >
          {(['left', 'center', 'right'] as const).map((alignment) => (
            <button
              aria-label={
                alignment === 'left'
                  ? t('Görseli sola hizala')
                  : alignment === 'center'
                    ? t('Görseli ortaya hizala')
                    : t('Görseli sağa hizala')
              }
              aria-pressed={attributes.alignment === alignment}
              key={alignment}
              onClick={() => updateAttributes({ alignment })}
              type="button"
            >
              {alignment === 'left' ? t('Sol') : alignment === 'center' ? t('Orta') : t('Sağ')}
            </button>
          ))}
        </div>
        <label>
          {t('Alt metin')}
          <input
            maxLength={500}
            onChange={(event) => updateAttributes({ alt: event.target.value })}
            placeholder={t('Görseli kısaca açıklayın')}
            value={attributes.alt}
          />
        </label>
      </div>
    </NodeViewWrapper>
  )
}
