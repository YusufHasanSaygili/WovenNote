import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'

import {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
  EDITOR_HIGHLIGHT_COLORS,
  EDITOR_INDENT_LEVELS,
  EDITOR_LINE_HEIGHTS,
  EDITOR_TEXT_COLORS,
} from '../../../shared/schemas/editor-document'

function allowedTextColor(value: unknown): value is (typeof EDITOR_TEXT_COLORS)[number] {
  return EDITOR_TEXT_COLORS.includes(value as (typeof EDITOR_TEXT_COLORS)[number])
}

function allowedHighlightColor(value: unknown): value is (typeof EDITOR_HIGHLIGHT_COLORS)[number] {
  return EDITOR_HIGHLIGHT_COLORS.includes(value as (typeof EDITOR_HIGHLIGHT_COLORS)[number])
}

function allowedFontFamily(value: unknown): value is (typeof EDITOR_FONT_FAMILIES)[number] {
  return EDITOR_FONT_FAMILIES.includes(value as (typeof EDITOR_FONT_FAMILIES)[number])
}

function allowedFontSize(value: unknown): value is (typeof EDITOR_FONT_SIZES)[number] {
  return EDITOR_FONT_SIZES.includes(value as (typeof EDITOR_FONT_SIZES)[number])
}

function allowedLineHeight(value: unknown): value is (typeof EDITOR_LINE_HEIGHTS)[number] {
  return EDITOR_LINE_HEIGHTS.includes(value as (typeof EDITOR_LINE_HEIGHTS)[number])
}

function allowedIndent(value: unknown): value is (typeof EDITOR_INDENT_LEVELS)[number] {
  return EDITOR_INDENT_LEVELS.includes(value as (typeof EDITOR_INDENT_LEVELS)[number])
}

export const SafeColor = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element) => {
              const color = element.getAttribute('data-text-color')
              return allowedTextColor(color) ? color : null
            },
            renderHTML: (attributes) =>
              allowedTextColor(attributes['color'])
                ? { 'data-text-color': attributes['color'] }
                : {},
          },
        },
      },
    ]
  },
})

export const SafeHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const color = element.getAttribute('data-highlight-color')
          return allowedHighlightColor(color) ? color : null
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          allowedHighlightColor(attributes['color'])
            ? { 'data-highlight-color': attributes['color'] }
            : {},
      },
    }
  },
}).configure({ multicolor: true })

export const SafeFontFamily = FontFamily.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => {
              const fontFamily = element.getAttribute('data-font-family')
              return allowedFontFamily(fontFamily) ? fontFamily : null
            },
            renderHTML: (attributes) =>
              allowedFontFamily(attributes['fontFamily'])
                ? { 'data-font-family': attributes['fontFamily'] }
                : {},
          },
        },
      },
    ]
  },
})

export const SafeFontSize = FontSize.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const fontSize = element.getAttribute('data-font-size')
              return allowedFontSize(fontSize) ? fontSize : null
            },
            renderHTML: (attributes) =>
              allowedFontSize(attributes['fontSize'])
                ? { 'data-font-size': attributes['fontSize'] }
                : {},
          },
        },
      },
    ]
  },
})

const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const

export const SafeTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => {
              const alignment = element.getAttribute('data-text-align')
              return ALIGNMENTS.includes(alignment as (typeof ALIGNMENTS)[number])
                ? alignment
                : this.options.defaultAlignment
            },
            renderHTML: (attributes) =>
              ALIGNMENTS.includes(attributes['textAlign'] as (typeof ALIGNMENTS)[number])
                ? { 'data-text-align': attributes['textAlign'] }
                : {},
          },
        },
      },
    ]
  },
}).configure({ types: ['heading', 'paragraph'] })

export const SafeBlockLayout = Extension.create({
  name: 'safeBlockLayout',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const lineHeight = element.getAttribute('data-line-height')
              return allowedLineHeight(lineHeight) ? lineHeight : null
            },
            renderHTML: (attributes) =>
              allowedLineHeight(attributes['lineHeight'])
                ? { 'data-line-height': attributes['lineHeight'] }
                : {},
          },
          indent: {
            default: 0,
            parseHTML: (element) => {
              const value = Number(element.getAttribute('data-indent'))
              return allowedIndent(value) ? value : 0
            },
            renderHTML: (attributes) =>
              allowedIndent(attributes['indent']) && attributes['indent'] > 0
                ? { 'data-indent': String(attributes['indent']) }
                : {},
          },
        },
      },
    ]
  },
})
