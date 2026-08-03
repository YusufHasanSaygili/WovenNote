export type ZoomDirection = 'in' | 'out'

interface ZoomController {
  readonly getZoomLevel: () => number
  readonly setZoomLevel: (level: number) => void
}

interface ControlWheelEvent {
  readonly ctrlKey: boolean
  readonly deltaY: number
  readonly preventDefault: () => void
}

export const MIN_WINDOW_ZOOM_LEVEL = Math.log(0.5) / Math.log(1.2)
export const MAX_WINDOW_ZOOM_LEVEL = Math.log(3) / Math.log(1.2)
export const WINDOW_ZOOM_LEVEL_STEP = 0.5

export function nextWindowZoomLevel(currentLevel: number, direction: ZoomDirection): number {
  const delta = direction === 'in' ? WINDOW_ZOOM_LEVEL_STEP : -WINDOW_ZOOM_LEVEL_STEP
  return Math.min(MAX_WINDOW_ZOOM_LEVEL, Math.max(MIN_WINDOW_ZOOM_LEVEL, currentLevel + delta))
}

export function applyWindowZoom(controller: ZoomController, direction: ZoomDirection): void {
  const currentLevel = controller.getZoomLevel()
  const nextLevel = nextWindowZoomLevel(currentLevel, direction)
  if (nextLevel !== currentLevel) controller.setZoomLevel(nextLevel)
}

export function handleControlWheelZoom(
  event: ControlWheelEvent,
  controller: ZoomController,
): boolean {
  if (!event.ctrlKey || event.deltaY === 0) return false

  event.preventDefault()
  applyWindowZoom(controller, event.deltaY < 0 ? 'in' : 'out')
  return true
}
