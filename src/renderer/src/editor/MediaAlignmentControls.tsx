import { useI18n } from '../i18n/i18n'

export type MediaAlignment = 'left' | 'center' | 'right'

interface MediaAlignmentControlsProps {
  readonly alignment: MediaAlignment
  readonly onChange: (alignment: MediaAlignment) => void
}

export function MediaAlignmentControls({
  alignment,
  onChange,
}: MediaAlignmentControlsProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div
      className="media-alignment-controls"
      contentEditable={false}
      role="group"
      aria-label={t('Video hizalama')}
    >
      {(['left', 'center', 'right'] as const).map((nextAlignment) => (
        <button
          aria-label={
            nextAlignment === 'left'
              ? t('Videoyu sola hizala')
              : nextAlignment === 'center'
                ? t('Videoyu ortaya hizala')
                : t('Videoyu sağa hizala')
          }
          aria-pressed={alignment === nextAlignment}
          key={nextAlignment}
          onClick={() => onChange(nextAlignment)}
          type="button"
        >
          {nextAlignment === 'left' ? t('Sol') : nextAlignment === 'center' ? t('Orta') : t('Sağ')}
        </button>
      ))}
    </div>
  )
}
