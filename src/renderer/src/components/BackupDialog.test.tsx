import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BackupDialog } from './BackupDialog'

const cancelledCreate = async () => ({ ok: true as const, data: { status: 'cancelled' as const } })
const cancelledInspect = async () => ({ ok: true as const, data: { status: 'cancelled' as const } })

describe('BackupDialog', () => {
  it('shows a visible full-backup success summary', async () => {
    render(
      <BackupDialog
        createBackup={async () => ({
          ok: true,
          data: {
            status: 'saved',
            fileName: 'WovenNote.wovennote-backup',
            bytesWritten: 1024,
            notes: 4,
            attachments: 2,
          },
        })}
        inspectBackup={cancelledInspect}
        onClose={vi.fn()}
        onRestored={vi.fn()}
        restoreBackup={async () => ({
          ok: false,
          error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen çağrı.' },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Tam yedek oluştur/ }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'WovenNote.wovennote-backup kaydedildi (4 not, 2 medya).',
    )
  })

  it('previews conflicts and restores with the explicitly selected strategy', async () => {
    const restoreBackup = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: 'restored' as const,
        notesImported: 3,
        notesSkipped: 0,
        attachmentsImported: 1,
      },
    }))
    const onRestored = vi.fn()
    render(
      <BackupDialog
        createBackup={cancelledCreate}
        inspectBackup={async () => ({
          ok: true,
          data: {
            status: 'ready',
            importToken: '00000000-0000-4000-8000-000000000000',
            summary: {
              createdAt: '2026-07-28T20:00:00.000Z',
              notes: 3,
              attachments: 1,
              chatMessages: 5,
              noteConflicts: 2,
            },
          },
        })}
        onClose={vi.fn()}
        onRestored={onRestored}
        restoreBackup={restoreBackup}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Yedekten geri yükle/ }))
    expect(await screen.findByLabelText('Yedek özeti')).toHaveTextContent('2 kimlik çakışması')
    fireEvent.click(screen.getByRole('radio', { name: /İkisini de sakla/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Geri yüklemeyi başlat' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 not geri yüklendi; 0 not atlandı.',
    )
    expect(restoreBackup).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000000', 'keep-both')
    expect(onRestored).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'restored', notesImported: 3 }),
    )
  })

  it('shows corrupt-backup failures without leaving a restore action behind', async () => {
    render(
      <BackupDialog
        createBackup={cancelledCreate}
        inspectBackup={async () => ({
          ok: false,
          error: { code: 'OPERATION_FAILED', message: 'Yedek bozuk.' },
        })}
        onClose={vi.fn()}
        onRestored={vi.fn()}
        restoreBackup={async () => ({
          ok: false,
          error: { code: 'OPERATION_FAILED', message: 'Beklenmeyen çağrı.' },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Yedekten geri yükle/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Yedek bozuk.')
    expect(screen.queryByRole('button', { name: 'Geri yüklemeyi başlat' })).not.toBeInTheDocument()
  })
})
