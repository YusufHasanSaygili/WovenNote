import type { BrowserWindowConstructorOptions, WebPreferences } from 'electron'

export const SECURE_WEB_PREFERENCES = Object.freeze({
  allowRunningInsecureContent: false,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  webviewTag: false,
}) satisfies Readonly<WebPreferences>

export function createMainWindowOptions(
  preloadPath: string,
  iconPath: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'WovenNote',
    icon: iconPath,
    backgroundColor: '#f4f7fb',
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: preloadPath,
    },
  }
}
