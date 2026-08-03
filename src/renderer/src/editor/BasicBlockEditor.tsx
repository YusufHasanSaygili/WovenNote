import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { TableKit } from '@tiptap/extension-table'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'

import type { Attachment } from '../../../shared/schemas/attachment-contracts'
import { TiptapDocumentSchema, type TiptapDocument } from '../../../shared/schemas/editor-document'
import { useI18n } from '../i18n/i18n'
import { AttachmentImage, insertAttachmentImage } from './attachment-image'
import { AttachmentFile, AttachmentVideo, insertAttachmentMedia } from './attachment-media'
import { BlockDragDrop } from './block-drag-drop'
import { normalizeEditorLink } from './editor-link'
import {
  SafeBlockLayout,
  SafeColor,
  SafeFontFamily,
  SafeFontSize,
  SafeHighlight,
  SafeTextAlign,
} from './editor-polish-extensions'
import { EditorToolbar, InlineFormatButtons } from './EditorToolbar'
import { findEditorTextMatches, selectEditorTextMatch, type EditorTextMatch } from './editor-search'
import { parseYouTubeVideoUrl } from './youtube-url'
import { insertYouTubeVideo, YouTubeVideo } from './youtube-video'

interface BasicBlockEditorProps {
  readonly initialDocument: TiptapDocument
  readonly onDocumentChange: (document: TiptapDocument) => void
  readonly onPickAttachment: (accept: 'image' | 'video' | 'file') => Promise<Attachment | null>
}

export function BasicBlockEditor({
  initialDocument,
  onDocumentChange,
  onPickAttachment,
}: BasicBlockEditorProps): React.JSX.Element {
  const { t } = useI18n()
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [pickingType, setPickingType] = useState<'image' | 'video' | 'file' | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatches, setSearchMatches] = useState<EditorTextMatch[]>([])
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [showFormattingMarks, setShowFormattingMarks] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    content: initialDocument,
    extensions: [
      StarterKit.configure({
        blockquote: {},
        bold: {},
        bulletList: {},
        code: {},
        codeBlock: {},
        dropcursor: { color: '#5364d8', width: 3 },
        hardBreak: {},
        heading: { levels: [1, 2, 3] },
        horizontalRule: {},
        italic: {},
        link: { openOnClick: false },
        listItem: {},
        listKeymap: false,
        orderedList: {},
        strike: {},
        trailingNode: false,
        underline: {},
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      AttachmentImage,
      AttachmentVideo,
      AttachmentFile,
      YouTubeVideo,
      BlockDragDrop,
      TableKit.configure({ table: { resizable: false } }),
      TextStyle,
      SafeColor,
      SafeFontFamily,
      SafeFontSize,
      SafeHighlight,
      SafeTextAlign,
      SafeBlockLayout,
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const document = TiptapDocumentSchema.safeParse(updatedEditor.getJSON())
      if (document.success) onDocumentChange(document.data)
    },
  })

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr-TR') === 'f') {
        event.preventDefault()
        setIsSearchOpen(true)
        queueMicrotask(() => searchInputRef.current?.focus())
      }
    }
    globalThis.addEventListener('keydown', handleFindShortcut)
    return () => globalThis.removeEventListener('keydown', handleFindShortcut)
  }, [])

  if (!editor) {
    return <p className="editor-loading-state">{t('Editör hazırlanıyor…')}</p>
  }

  const applyLink = (): void => {
    const youtubeVideo = parseYouTubeVideoUrl(linkValue)
    if (youtubeVideo) {
      if (!insertYouTubeVideo(editor, youtubeVideo.videoId)) {
        setLinkError(t('YouTube videosu editöre eklenemedi.'))
        return
      }
      setLinkError(null)
      setLinkValue('')
      setIsLinkEditorOpen(false)
      return
    }

    const href = normalizeEditorLink(linkValue)
    if (!href) {
      setLinkError(t('Geçerli bir HTTP, HTTPS veya e-posta bağlantısı girin.'))
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setIsLinkEditorOpen(false)
    setLinkError(null)
    setLinkValue('')
  }

  const runSearch = (query: string, requestedIndex = 0): void => {
    const matches = findEditorTextMatches(editor.state.doc, query)
    setSearchQuery(query)
    setSearchMatches(matches)

    if (matches.length === 0) {
      setActiveSearchIndex(0)
      return
    }

    const nextIndex = ((requestedIndex % matches.length) + matches.length) % matches.length
    setActiveSearchIndex(nextIndex)
    selectEditorTextMatch(editor, matches[nextIndex])
  }

  const stepSearch = (direction: 1 | -1): void => {
    runSearch(searchQuery, activeSearchIndex + direction)
  }

  const closeSearch = (): void => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setSearchMatches([])
    setActiveSearchIndex(0)
    editor.commands.focus()
  }

  const pickAttachment = async (accept: 'image' | 'video' | 'file'): Promise<void> => {
    setMediaError(null)
    setPickingType(accept)
    try {
      const attachment = await onPickAttachment(accept)
      if (!attachment) return
      const categoryMatches =
        (accept === 'image' && attachment.mimeType.startsWith('image/')) ||
        (accept === 'video' && attachment.mimeType.startsWith('video/')) ||
        (accept === 'file' && !/^(image|video)\//.test(attachment.mimeType))
      if (!categoryMatches) {
        setMediaError(t('Seçilen dosya bu medya komutuyla uyumlu değil.'))
        return
      }
      const inserted = attachment.mimeType.startsWith('image/')
        ? insertAttachmentImage(editor, attachment.id)
        : insertAttachmentMedia(
            editor,
            attachment.mimeType.startsWith('video/') ? 'attachmentVideo' : 'attachmentFile',
            attachment.id,
          )
      if (!inserted) {
        setMediaError(t('Dosya editöre eklenemedi. Lütfen tekrar deneyin.'))
      }
    } catch (error) {
      setMediaError(
        error instanceof Error ? error.message : t('Görsel eklenemedi. Lütfen tekrar deneyin.'),
      )
    } finally {
      setPickingType(null)
    }
  }

  return (
    <div className="basic-editor">
      <EditorToolbar
        editor={editor}
        onOpenSearch={() => {
          setIsSearchOpen(true)
          queueMicrotask(() => searchInputRef.current?.focus())
        }}
        onPickAttachment={(type) => void pickAttachment(type)}
        onToggleLinkEditor={() => setIsLinkEditorOpen((open) => !open)}
        pickingType={pickingType}
        showFormattingMarks={showFormattingMarks}
        toggleFormattingMarks={() => setShowFormattingMarks((visible) => !visible)}
      />
      {mediaError ? (
        <p className="editor-media-error" role="alert">
          {mediaError}
        </p>
      ) : null}
      {isSearchOpen ? (
        <div className="editor-search" role="search" aria-label={t('Not içinde ara')}>
          <label htmlFor="editor-search-query">{t('Not içinde ara')}</label>
          <input
            id="editor-search-query"
            onChange={(event) => runSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                stepSearch(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeSearch()
              }
            }}
            ref={searchInputRef}
            type="search"
            value={searchQuery}
          />
          <output aria-live="polite">
            {searchQuery.length === 0
              ? t('Arama metni girin')
              : searchMatches.length === 0
                ? t('Sonuç yok')
                : `${activeSearchIndex + 1} / ${searchMatches.length}`}
          </output>
          <button
            aria-label={t('Önceki eşleşme')}
            disabled={searchMatches.length === 0}
            onClick={() => stepSearch(-1)}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={t('Sonraki eşleşme')}
            disabled={searchMatches.length === 0}
            onClick={() => stepSearch(1)}
            type="button"
          >
            ↓
          </button>
          <button aria-label={t('Aramayı kapat')} onClick={closeSearch} type="button">
            ×
          </button>
        </div>
      ) : null}
      {isLinkEditorOpen ? (
        <div className="link-editor" role="group" aria-label={t('Bağlantı düzenleyici')}>
          <label htmlFor="editor-link-url">{t('Bağlantı adresi')}</label>
          <input
            id="editor-link-url"
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://example.com"
            type="url"
            value={linkValue}
          />
          <small>{t('YouTube bağlantıları oynatılabilir video olarak eklenir.')}</small>
          <button className="secondary-button" onClick={applyLink} type="button">
            {t('Uygula')}
          </button>
          {editor.isActive('link') ? (
            <button
              className="secondary-button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              type="button"
            >
              {t('Bağlantıyı kaldır')}
            </button>
          ) : null}
          {linkError ? <p role="alert">{linkError}</p> : null}
        </div>
      ) : null}
      <BubbleMenu className="editor-bubble-menu" editor={editor}>
        <InlineFormatButtons editor={editor} />
      </BubbleMenu>
      <EditorContent
        editor={editor}
        className={`tiptap-editor-surface${showFormattingMarks ? ' show-formatting-marks' : ''}`}
      />
    </div>
  )
}
