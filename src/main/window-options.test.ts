// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { createMainWindowOptions, SECURE_WEB_PREFERENCES } from './window-options'

describe('secure BrowserWindow options', () => {
  it('locks down renderer capabilities', () => {
    expect(SECURE_WEB_PREFERENCES).toEqual({
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    })
  })

  it('adds the resolved preload and application icon paths to the secure defaults', () => {
    const options = createMainWindowOptions(
      'C:\\WovenNote\\preload.js',
      'C:\\WovenNote\\build\\icon.png',
    )

    expect(options.icon).toBe('C:\\WovenNote\\build\\icon.png')
    expect(options.webPreferences).toEqual({
      ...SECURE_WEB_PREFERENCES,
      preload: 'C:\\WovenNote\\preload.js',
    })
  })
})
