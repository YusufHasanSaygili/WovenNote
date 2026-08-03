import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExportNoteDialog } from './ExportNoteDialog'

describe('ExportNoteDialog', () => {
  it('shows the saved file name after a successful export', async () => {
    const onExport = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'saved' as const,
        format: 'json' as const,
        fileName: 'plan.json',
        bytesWritten: 42,
      },
    }))
    render(<ExportNoteDialog noteTitle="Plan" onClose={vi.fn()} onExport={onExport} />)

    fireEvent.click(screen.getByRole('button', { name: /WovenNote JSON/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('plan.json başarıyla kaydedildi.')
    expect(onExport).toHaveBeenCalledWith('json')
  })

  it('reports cancellation as information rather than an error', async () => {
    render(
      <ExportNoteDialog
        noteTitle="Plan"
        onClose={vi.fn()}
        onExport={async () => ({ ok: true, data: { status: 'cancelled' } })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Düz metin/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Dışa aktarma iptal edildi.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the dialog usable after a write failure', async () => {
    render(
      <ExportNoteDialog
        noteTitle="Plan"
        onClose={vi.fn()}
        onExport={async () => ({
          ok: false,
          error: { code: 'OPERATION_FAILED', message: 'Hedef yazılamadı.' },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Markdown/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Hedef yazılamadı.')
    expect(screen.getByRole('button', { name: 'Kapat' })).toBeEnabled()
  })

  it('offers PDF as a real export action', async () => {
    const onExport = vi.fn(async () => ({
      ok: true as const,
      data: { status: 'cancelled' as const },
    }))
    render(<ExportNoteDialog noteTitle="Plan" onClose={vi.fn()} onExport={onExport} />)

    fireEvent.click(screen.getByRole('button', { name: /PDF belgesi/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Dışa aktarma iptal edildi.')
    expect(onExport).toHaveBeenCalledWith('pdf')
  })
})
