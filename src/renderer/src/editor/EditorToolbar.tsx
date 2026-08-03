import type { Editor } from '@tiptap/core'

import {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
  EDITOR_HIGHLIGHT_COLORS,
  EDITOR_INDENT_LEVELS,
  EDITOR_LINE_HEIGHTS,
  EDITOR_TEXT_COLORS,
} from '../../../shared/schemas/editor-document'
import { useI18n } from '../i18n/i18n'

type AttachmentPickerType = 'image' | 'video' | 'file'
type TextBlockType = 'heading' | 'paragraph'

interface EditorToolbarProps {
  readonly editor: Editor
  readonly onOpenSearch: () => void
  readonly onPickAttachment: (type: AttachmentPickerType) => void
  readonly onToggleLinkEditor: () => void
  readonly pickingType: AttachmentPickerType | null
  readonly showFormattingMarks: boolean
  readonly toggleFormattingMarks: () => void
}

const TEXT_COLOR_OPTIONS = [
  ['#172033', 'Siyah'],
  ['#b42318', 'Kırmızı'],
  ['#c2410c', 'Turuncu'],
  ['#047857', 'Yeşil'],
  ['#1d4ed8', 'Mavi'],
  ['#7e22ce', 'Mor'],
] as const satisfies ReadonlyArray<readonly [(typeof EDITOR_TEXT_COLORS)[number], string]>

const HIGHLIGHT_COLOR_OPTIONS = [
  ['#fef3c7', 'Sarı'],
  ['#fee2e2', 'Kırmızı'],
  ['#dcfce7', 'Yeşil'],
  ['#dbeafe', 'Mavi'],
  ['#f3e8ff', 'Mor'],
] as const satisfies ReadonlyArray<readonly [(typeof EDITOR_HIGHLIGHT_COLORS)[number], string]>

function activeTextBlock(editor: Editor): TextBlockType {
  return editor.isActive('heading') ? 'heading' : 'paragraph'
}

function changeIndent(editor: Editor, direction: -1 | 1): void {
  const block = activeTextBlock(editor)
  const current = editor.getAttributes(block)['indent']
  const normalized =
    typeof current === 'number' && EDITOR_INDENT_LEVELS.includes(current as 0 | 1 | 2 | 3 | 4)
      ? current
      : 0
  const next = Math.max(0, Math.min(4, normalized + direction))
  editor.chain().focus().updateAttributes(block, { indent: next }).run()
}

function changeFontSize(editor: Editor, direction: -1 | 1): void {
  const current = editor.getAttributes('textStyle')['fontSize']
  const currentIndex = EDITOR_FONT_SIZES.indexOf(
    EDITOR_FONT_SIZES.includes(current as (typeof EDITOR_FONT_SIZES)[number])
      ? (current as (typeof EDITOR_FONT_SIZES)[number])
      : '11pt',
  )
  const nextIndex = Math.max(0, Math.min(EDITOR_FONT_SIZES.length - 1, currentIndex + direction))
  const next = EDITOR_FONT_SIZES[nextIndex]
  if (next) editor.chain().focus().setFontSize(next).run()
}

export function InlineFormatButtons({ editor }: { readonly editor: Editor }): React.JSX.Element {
  const { t } = useI18n()
  const formats = [
    {
      label: t('Kalın'),
      shortLabel: 'B',
      name: 'bold',
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: t('İtalik'),
      shortLabel: 'I',
      name: 'italic',
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: t('Altı çizili'),
      shortLabel: 'U',
      name: 'underline',
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
  ] as const

  return (
    <>
      {formats.map((format) => (
        <button
          aria-label={format.label}
          aria-pressed={editor.isActive(format.name)}
          className={`ribbon-format-${format.name}`}
          key={format.name}
          onClick={format.run}
          title={format.label}
          type="button"
        >
          {format.shortLabel}
        </button>
      ))}
    </>
  )
}

export function EditorToolbar({
  editor,
  onOpenSearch,
  onPickAttachment,
  onToggleLinkEditor,
  pickingType,
  showFormattingMarks,
  toggleFormattingMarks,
}: EditorToolbarProps): React.JSX.Element {
  const { t } = useI18n()
  const textStyle = editor.getAttributes('textStyle')
  const block = activeTextBlock(editor)
  const blockAttributes = editor.getAttributes(block)

  return (
    <div className="basic-editor-toolbar" role="toolbar" aria-label={t('Editör araçları')}>
      <section className="editor-ribbon-group editor-ribbon-history" aria-label={t('Geçmiş')}>
        <div className="editor-ribbon-row">
          <button
            aria-label={t('Geri al')}
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title={t('Geri al (Ctrl+Z)')}
            type="button"
          >
            ↶
          </button>
          <button
            aria-label={t('Yinele')}
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title={t('Yinele (Ctrl+Y)')}
            type="button"
          >
            ↷
          </button>
        </div>
        <span className="editor-ribbon-label">{t('Geçmiş')}</span>
      </section>

      <section
        className="editor-ribbon-group editor-ribbon-font"
        aria-label={t('Yazı tipi araçları')}
      >
        <div className="editor-ribbon-row">
          <label className="toolbar-select-label font-family-control">
            <span>{t('Yazı tipi')}</span>
            <select
              aria-label={t('Yazı tipi')}
              onChange={(event) => {
                const font = event.target.value
                if (EDITOR_FONT_FAMILIES.includes(font as (typeof EDITOR_FONT_FAMILIES)[number])) {
                  editor.chain().focus().setFontFamily(font).run()
                } else {
                  editor.chain().focus().unsetFontFamily().run()
                }
              }}
              value={typeof textStyle['fontFamily'] === 'string' ? textStyle['fontFamily'] : ''}
            >
              <option value="">Aptos ({t('varsayılan')})</option>
              {EDITOR_FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
          <label className="toolbar-select-label font-size-control">
            <span>{t('Punto')}</span>
            <select
              aria-label={t('Punto')}
              onChange={(event) => {
                const size = event.target.value
                if (EDITOR_FONT_SIZES.includes(size as (typeof EDITOR_FONT_SIZES)[number])) {
                  editor.chain().focus().setFontSize(size).run()
                } else {
                  editor.chain().focus().unsetFontSize().run()
                }
              }}
              value={typeof textStyle['fontSize'] === 'string' ? textStyle['fontSize'] : ''}
            >
              <option value="">11</option>
              {EDITOR_FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size.replace('pt', '')}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label={t('Puntoyu büyüt')}
            onClick={() => changeFontSize(editor, 1)}
            title={t('Puntoyu büyüt')}
            type="button"
          >
            A<sup>+</sup>
          </button>
          <button
            aria-label={t('Puntoyu küçült')}
            onClick={() => changeFontSize(editor, -1)}
            title={t('Puntoyu küçült')}
            type="button"
          >
            A<sup>−</sup>
          </button>
        </div>
        <div className="editor-ribbon-row">
          <InlineFormatButtons editor={editor} />
          <label className="toolbar-select-label ribbon-color-control">
            <span>{t('Metin rengi')}</span>
            <select
              aria-label={t('Metin rengi')}
              onChange={(event) => {
                const color = event.target.value
                if (EDITOR_TEXT_COLORS.includes(color as (typeof EDITOR_TEXT_COLORS)[number])) {
                  editor.chain().focus().setColor(color).run()
                } else {
                  editor.chain().focus().unsetColor().run()
                }
              }}
              value={typeof textStyle['color'] === 'string' ? textStyle['color'] : ''}
            >
              <option value="">A · {t('Renk')}</option>
              {TEXT_COLOR_OPTIONS.map(([color, label]) => (
                <option key={color} value={color}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className="toolbar-select-label ribbon-color-control">
            <span>{t('Vurgu rengi')}</span>
            <select
              aria-label={t('Vurgu rengi')}
              onChange={(event) => {
                const color = event.target.value
                if (
                  EDITOR_HIGHLIGHT_COLORS.includes(
                    color as (typeof EDITOR_HIGHLIGHT_COLORS)[number],
                  )
                ) {
                  editor.chain().focus().setHighlight({ color }).run()
                } else {
                  editor.chain().focus().unsetHighlight().run()
                }
              }}
              value={editor.getAttributes('highlight')['color'] ?? ''}
            >
              <option value="">{t('Vurgu')}</option>
              {HIGHLIGHT_COLOR_OPTIONS.map(([color, label]) => (
                <option key={color} value={color}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="editor-ribbon-label">{t('Yazı tipi')}</span>
      </section>

      <section className="editor-ribbon-group editor-ribbon-paragraph" aria-label={t('Paragraf')}>
        <div className="editor-ribbon-row">
          <button
            aria-label={t('Madde listesi')}
            aria-pressed={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title={t('Madde işaretleri')}
            type="button"
          >
            •≡
          </button>
          <button
            aria-label={t('Numaralı liste')}
            aria-pressed={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title={t('Numaralandırma')}
            type="button"
          >
            1≡
          </button>
          <button
            aria-label={t('Yapılacaklar listesi')}
            aria-pressed={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title={t('Yapılacaklar listesi')}
            type="button"
          >
            ☐
          </button>
          <button
            aria-label={t('Girintiyi azalt')}
            disabled={(blockAttributes['indent'] ?? 0) === 0}
            onClick={() => changeIndent(editor, -1)}
            title={t('Girintiyi azalt')}
            type="button"
          >
            ⇤
          </button>
          <button
            aria-label={t('Girintiyi artır')}
            disabled={(blockAttributes['indent'] ?? 0) === 4}
            onClick={() => changeIndent(editor, 1)}
            title={t('Girintiyi artır')}
            type="button"
          >
            ⇥
          </button>
          <button
            aria-label={t('Biçimlendirme işaretlerini göster')}
            aria-pressed={showFormattingMarks}
            onClick={toggleFormattingMarks}
            title={t('Biçimlendirme işaretlerini göster')}
            type="button"
          >
            ¶
          </button>
        </div>
        <div className="editor-ribbon-row">
          {(['left', 'center', 'right', 'justify'] as const).map((alignment) => (
            <button
              aria-label={
                alignment === 'left'
                  ? t('Sola hizala')
                  : alignment === 'center'
                    ? t('Ortala')
                    : alignment === 'right'
                      ? t('Sağa hizala')
                      : t('İki yana yasla')
              }
              aria-pressed={editor.isActive({ textAlign: alignment })}
              key={alignment}
              onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
              title={alignment}
              type="button"
            >
              {alignment === 'left'
                ? '≡‹'
                : alignment === 'center'
                  ? '≡'
                  : alignment === 'right'
                    ? '›≡'
                    : '▤'}
            </button>
          ))}
          <label className="toolbar-select-label line-height-control">
            <span>{t('Satır aralığı')}</span>
            <select
              aria-label={t('Satır aralığı')}
              onChange={(event) => {
                const lineHeight = event.target.value
                editor
                  .chain()
                  .focus()
                  .updateAttributes(block, {
                    lineHeight: EDITOR_LINE_HEIGHTS.includes(
                      lineHeight as (typeof EDITOR_LINE_HEIGHTS)[number],
                    )
                      ? lineHeight
                      : null,
                  })
                  .run()
              }}
              value={
                typeof blockAttributes['lineHeight'] === 'string'
                  ? blockAttributes['lineHeight']
                  : ''
              }
            >
              <option value="">{t('Satır aralığı')}</option>
              {EDITOR_LINE_HEIGHTS.map((lineHeight) => (
                <option key={lineHeight} value={lineHeight}>
                  {lineHeight}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="editor-ribbon-label">{t('Paragraf')}</span>
      </section>

      <section
        className="editor-ribbon-group editor-ribbon-insert"
        aria-label={t('Ekle ve araçlar')}
      >
        <div className="editor-ribbon-row">
          <button
            aria-label={t('Not içinde ara')}
            onClick={onOpenSearch}
            title={t('Bul (Ctrl+F)')}
            type="button"
          >
            ⌕
          </button>
          <button
            aria-label={t('Bağlantı ekle')}
            aria-pressed={editor.isActive('link')}
            onClick={onToggleLinkEditor}
            title={t('Bağlantı ekle')}
            type="button"
          >
            🔗
          </button>
          <button
            aria-label={t('Alıntı')}
            aria-pressed={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title={t('Alıntı')}
            type="button"
          >
            “ ”
          </button>
          <button
            aria-label={t('Kod bloğu')}
            aria-pressed={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title={t('Kod bloğu')}
            type="button"
          >
            &lt;/&gt;
          </button>
          <button
            aria-label={t('Yatay ayırıcı ekle')}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title={t('Yatay ayırıcı')}
            type="button"
          >
            ―
          </button>
        </div>
        <div className="editor-ribbon-row">
          <button
            aria-label={t('Resim ekle')}
            disabled={pickingType !== null}
            onClick={() => onPickAttachment('image')}
            title={pickingType === 'image' ? t('Görsel seçiliyor…') : t('Resim ekle')}
            type="button"
          >
            {t('Resim')}
          </button>
          <button
            aria-label={t('Video ekle')}
            disabled={pickingType !== null}
            onClick={() => onPickAttachment('video')}
            title={pickingType === 'video' ? t('Video seçiliyor…') : t('Video ekle')}
            type="button"
          >
            ▶
          </button>
          <button
            aria-label={t('PDF veya dosya ekle')}
            disabled={pickingType !== null}
            onClick={() => onPickAttachment('file')}
            title={pickingType === 'file' ? t('Dosya seçiliyor…') : t('PDF veya dosya ekle')}
            type="button"
          >
            PDF
          </button>
          <button
            aria-label={t('3 × 3 tablo ekle')}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title={t('3 × 3 tablo ekle')}
            type="button"
          >
            ▦
          </button>
        </div>
        <span className="editor-ribbon-label">{t('Ekle')}</span>
      </section>

      {editor.isActive('table') ? (
        <section
          className="editor-ribbon-group editor-ribbon-table"
          aria-label={t('Tablo araçları')}
        >
          <div className="editor-ribbon-row">
            <button onClick={() => editor.chain().focus().addRowAfter().run()} type="button">
              {t('Satır ekle')}
            </button>
            <button onClick={() => editor.chain().focus().deleteRow().run()} type="button">
              {t('Satırı sil')}
            </button>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()} type="button">
              {t('Sütun ekle')}
            </button>
            <button onClick={() => editor.chain().focus().deleteColumn().run()} type="button">
              {t('Sütunu sil')}
            </button>
            <button onClick={() => editor.chain().focus().deleteTable().run()} type="button">
              {t('Tabloyu sil')}
            </button>
          </div>
          <span className="editor-ribbon-label">{t('Tablo')}</span>
        </section>
      ) : null}
    </div>
  )
}
