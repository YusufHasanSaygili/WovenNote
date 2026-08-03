import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useModalFocusTrap } from './useModalFocusTrap'

function FocusTrapHarness({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { dialogRef, onKeyDown } = useModalFocusTrap(onClose)
  return (
    <section onKeyDown={onKeyDown} ref={dialogRef} role="dialog">
      <button type="button">Birinci</button>
      <button type="button">Sonuncu</button>
    </section>
  )
}

function ReturnFocusHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Aç
      </button>
      {open ? <FocusTrapHarness onClose={() => setOpen(false)} /> : null}
    </>
  )
}

describe('useModalFocusTrap', () => {
  it('wraps tab focus, closes with Escape and returns focus to the trigger', async () => {
    render(<ReturnFocusHarness />)
    const trigger = screen.getByRole('button', { name: 'Aç' })
    trigger.focus()
    fireEvent.click(trigger)
    const first = screen.getByRole('button', { name: 'Birinci' })
    const last = screen.getByRole('button', { name: 'Sonuncu' })
    await waitFor(() => expect(first).toHaveFocus())
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('calls the supplied close action', () => {
    const onClose = vi.fn()
    render(<FocusTrapHarness onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
