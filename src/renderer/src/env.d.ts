/// <reference types="vite/client" />

import type { WovenNoteApi } from '../../shared/preload-api'

declare global {
  interface Window {
    readonly wovenNote: WovenNoteApi
  }
}

export {}
