import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { loadThemePreference, resolveTheme } from './services/theme-preferences'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './styles.css'

const initialTheme = resolveTheme(
  loadThemePreference(window.localStorage),
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
)
document.documentElement.dataset['theme'] = initialTheme
document.documentElement.style.colorScheme = initialTheme

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('WovenNote uygulama kökü bulunamadı.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
