import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface ModalFocusTrap {
  readonly dialogRef: RefObject<HTMLElement | null>
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  )
}

export function useModalFocusTrap(onClose: () => void, disabled = false): ModalFocusTrap {
  const dialogRef = useRef<HTMLElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )

  useEffect(() => {
    const previouslyFocused = previouslyFocusedRef.current
    const frame = globalThis.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(document.activeElement)) return
      focusableElements(dialog)[0]?.focus()
    })
    return () => {
      globalThis.cancelAnimationFrame(frame)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && !disabled) {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const elements = focusableElements(dialog)
    if (elements.length === 0) {
      event.preventDefault()
      return
    }
    const first = elements[0]!
    const last = elements.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { dialogRef, onKeyDown }
}
