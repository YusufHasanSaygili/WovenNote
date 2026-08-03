import { access } from 'node:fs/promises'
import process from 'node:process'

import { _electron as electron } from '@playwright/test'

const executablePath = process.env['WOVENNOTE_RELEASE_EXE']
const profilePath = process.env['WOVENNOTE_RELEASE_PROFILE']

if (!executablePath || !profilePath) {
  throw new Error('WOVENNOTE_RELEASE_EXE and WOVENNOTE_RELEASE_PROFILE are required.')
}

await access(executablePath)

const launchEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value),
)

let application
try {
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${profilePath}`],
    env: launchEnvironment,
  })
  const window = await application.firstWindow()
  await window.getByRole('heading', { name: 'WovenNote' }).waitFor({ state: 'visible' })

  await window.getByRole('combobox', { name: 'Dil' }).selectOption('en')
  await window.getByRole('button', { name: 'New Note', exact: true }).waitFor({ state: 'visible' })
  const languagePreference = await window.evaluate(() => ({
    documentLanguage: globalThis.document.documentElement.lang,
    storedLanguage: globalThis.localStorage.getItem('wovennote.language.v1'),
  }))

  const boundary = await window.evaluate(() => ({
    apiKeys: Object.keys(globalThis.wovenNote ?? {}),
    ipcRendererType: typeof globalThis.ipcRenderer,
    processType: typeof globalThis.process,
    requireType: typeof globalThis.require,
  }))
  const preferences = await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  )
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.setZoomLevel(0)
  })
  await window.mouse.move(400, 300)
  await window.keyboard.down('Control')
  await window.mouse.wheel(0, -120)
  await window.keyboard.up('Control')
  await window.waitForTimeout(100)
  const zoomAfterIn = await application.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel() ?? 0,
  )
  await window.keyboard.down('Control')
  await window.mouse.wheel(0, 120)
  await window.keyboard.up('Control')
  await window.waitForTimeout(100)
  const zoomAfterOut = await application.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel() ?? 1,
  )
  const roundTrip = await window.evaluate(async () => {
    const created = await globalThis.wovenNote.notes.create({ title: 'Kurulu paket smoke notu' })
    const listed = await globalThis.wovenNote.notes.list()
    return { created, listed }
  })

  if (
    boundary.processType !== 'undefined' ||
    boundary.requireType !== 'undefined' ||
    boundary.ipcRendererType !== 'undefined'
  ) {
    throw new Error('Installed renderer exposed a privileged global.')
  }
  if (
    preferences.contextIsolation !== true ||
    preferences.nodeIntegration !== false ||
    preferences.sandbox !== true ||
    preferences.webSecurity !== true
  ) {
    throw new Error('Installed BrowserWindow preferences are not hardened.')
  }
  if (
    languagePreference.documentLanguage !== 'en' ||
    languagePreference.storedLanguage !== 'en'
  ) {
    throw new Error('Installed package did not persist the selected interface language.')
  }
  if (zoomAfterIn <= 0 || zoomAfterOut !== 0) {
    throw new Error('Installed package did not handle Ctrl + mouse wheel zoom in both directions.')
  }
  if (
    !roundTrip.created.ok ||
    !roundTrip.listed.ok ||
    !roundTrip.listed.data.some((note) => note.id === roundTrip.created.data.id)
  ) {
    throw new Error('Installed package could not complete the SQLite create/list round trip.')
  }

  process.stdout.write(
    `${JSON.stringify({
      apiKeys: boundary.apiKeys,
      createdTitle: roundTrip.created.data.title,
      languagePreference,
      noteCount: roundTrip.listed.data.length,
      zoomLevels: { afterIn: zoomAfterIn, afterOut: zoomAfterOut },
      preferences: {
        contextIsolation: preferences.contextIsolation,
        nodeIntegration: preferences.nodeIntegration,
        sandbox: preferences.sandbox,
        webSecurity: preferences.webSecurity,
      },
    })}\n`,
  )
} finally {
  await application?.close().catch(() => undefined)
}
