import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InlineAiPreviewDialog } from './InlineAiPreviewDialog'

describe('InlineAiPreviewDialog', () => {
  it('keeps accept, regenerate and cancel as distinct explicit actions', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    const onRegenerate = vi.fn()
    render(
      <InlineAiPreviewDialog
        action="rewrite"
        error={null}
        isLoading={false}
        onAccept={onAccept}
        onCancel={onCancel}
        onRegenerate={onRegenerate}
        originalText="Özgün"
        resultText="Öneri"
      />,
    )

    expect(screen.getByText('Özgün')).toBeVisible()
    expect(screen.getByText('Öneri')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden oluştur' }))
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }))
    expect(onRegenerate).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAccept).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Kabul et' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('prevents acceptance while loading or after an error', () => {
    const { rerender } = render(
      <InlineAiPreviewDialog
        action="correct"
        error={null}
        isLoading
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onRegenerate={vi.fn()}
        originalText="Metin"
        resultText={null}
      />,
    )
    expect(screen.getByRole('button', { name: 'Kabul et' })).toBeDisabled()
    rerender(
      <InlineAiPreviewDialog
        action="correct"
        error="AI hatası"
        isLoading={false}
        onAccept={vi.fn()}
        onCancel={vi.fn()}
        onRegenerate={vi.fn()}
        originalText="Metin"
        resultText={null}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('AI hatası')
    expect(screen.getByRole('button', { name: 'Kabul et' })).toBeDisabled()
  })
})
