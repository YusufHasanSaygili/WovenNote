// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  handleControlWheelZoom,
  MAX_WINDOW_ZOOM_LEVEL,
  MIN_WINDOW_ZOOM_LEVEL,
  nextWindowZoomLevel,
  WINDOW_ZOOM_LEVEL_STEP,
} from './window-zoom'

describe('window zoom', () => {
  it('moves one step in the requested direction', () => {
    expect(nextWindowZoomLevel(0, 'in')).toBe(WINDOW_ZOOM_LEVEL_STEP)
    expect(nextWindowZoomLevel(0, 'out')).toBe(-WINDOW_ZOOM_LEVEL_STEP)
  })

  it('keeps zoom between 50% and 300%', () => {
    expect(nextWindowZoomLevel(MAX_WINDOW_ZOOM_LEVEL, 'in')).toBe(MAX_WINDOW_ZOOM_LEVEL)
    expect(nextWindowZoomLevel(MIN_WINDOW_ZOOM_LEVEL, 'out')).toBe(MIN_WINDOW_ZOOM_LEVEL)
  })

  it('zooms in and prevents normal scrolling for Ctrl + wheel up', () => {
    const preventDefault = vi.fn()
    const setZoomLevel = vi.fn()

    expect(
      handleControlWheelZoom(
        { ctrlKey: true, deltaY: -120, preventDefault },
        { getZoomLevel: () => 0, setZoomLevel },
      ),
    ).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(setZoomLevel).toHaveBeenCalledWith(WINDOW_ZOOM_LEVEL_STEP)
  })

  it('zooms out for Ctrl + wheel down and ignores unmodified scrolling', () => {
    const preventDefault = vi.fn()
    const setZoomLevel = vi.fn()
    const controller = { getZoomLevel: () => 0, setZoomLevel }

    expect(handleControlWheelZoom({ ctrlKey: true, deltaY: 120, preventDefault }, controller)).toBe(
      true,
    )
    expect(setZoomLevel).toHaveBeenCalledWith(-WINDOW_ZOOM_LEVEL_STEP)

    setZoomLevel.mockClear()
    expect(
      handleControlWheelZoom({ ctrlKey: false, deltaY: -120, preventDefault }, controller),
    ).toBe(false)
    expect(setZoomLevel).not.toHaveBeenCalled()
  })
})
