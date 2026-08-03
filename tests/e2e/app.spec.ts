import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron as electron, expect, test } from '@playwright/test'

import type { WovenNoteApi } from '../../src/shared/preload-api'

function electronLaunchEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  )
}

function contrastRatio(foreground: string, background: string): number {
  const channels = (color: string): number[] =>
    (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const normalized = value / 255
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
      })
  const luminance = (color: string): number => {
    const [red = 0, green = 0, blue = 0] = channels(color)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test('launches WovenNote with the hardened Electron boundary', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-boundary-e2e-'))
  const electronApp = await electron.launch({
    args: [`--user-data-dir=${profilePath}`, join(process.cwd(), 'out/main/index.js')],
    env: electronLaunchEnvironment(),
  })

  try {
    const window = await electronApp.firstWindow()
    await expect(window.getByRole('heading', { name: 'WovenNote' })).toBeVisible()

    const runningApp = await electronApp.evaluate(({ app, BrowserWindow }) => {
      return {
        name: app.getName(),
        windowCount: BrowserWindow.getAllWindows().length,
      }
    })

    expect(runningApp).toEqual({
      name: 'WovenNote',
      windowCount: 1,
    })

    const rendererBoundary = await window.evaluate(() => {
      const rendererGlobal = globalThis as typeof globalThis & {
        ipcRenderer?: unknown
        wovenNote?: Record<string, unknown>
        process?: unknown
        require?: unknown
      }

      return {
        apiKeys: Object.keys(rendererGlobal.wovenNote ?? {}),
        aiApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { ai?: Record<string, unknown> } | undefined)?.ai ?? {},
        ),
        attachmentApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { attachments?: Record<string, unknown> } | undefined)
            ?.attachments ?? {},
        ),
        exportApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { exports?: Record<string, unknown> } | undefined)
            ?.exports ?? {},
        ),
        noteApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { notes?: Record<string, unknown> } | undefined)?.notes ??
            {},
        ),
        organizationApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { organization?: Record<string, unknown> } | undefined)
            ?.organization ?? {},
        ),
        settingsApiKeys: Object.keys(
          (rendererGlobal.wovenNote as { settings?: Record<string, unknown> } | undefined)
            ?.settings ?? {},
        ),
        csp: document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute('content'),
        ipcRendererType: typeof rendererGlobal.ipcRenderer,
        processType: typeof rendererGlobal.process,
        requireType: typeof rendererGlobal.require,
        webviewCount: document.querySelectorAll('webview').length,
      }
    })

    expect(rendererBoundary.apiKeys).toEqual([
      'ai',
      'attachments',
      'getRuntimeInfo',
      'exports',
      'notes',
      'organization',
      'settings',
    ])
    expect(rendererBoundary.aiApiKeys).toEqual([
      'appendResponseToNote',
      'cancelInlineAction',
      'cancelRequest',
      'copyResponse',
      'createNoteFromResponse',
      'getThread',
      'runInlineAction',
      'sendMessage',
    ])
    expect(rendererBoundary.attachmentApiKeys).toEqual(['get', 'openExternal', 'pickAndStore'])
    expect(rendererBoundary.exportApiKeys).toEqual([
      'createBackup',
      'exportNote',
      'inspectBackup',
      'restoreBackup',
    ])
    expect(rendererBoundary.noteApiKeys).toEqual([
      'archive',
      'create',
      'duplicate',
      'list',
      'listArchived',
      'listTrashed',
      'listVersions',
      'open',
      'permanentlyDelete',
      'rename',
      'restore',
      'restoreVersion',
      'saveContent',
      'search',
      'softDelete',
      'unarchive',
      'updateLayouts',
    ])
    expect(rendererBoundary.organizationApiKeys).toEqual([
      'createTag',
      'listTags',
      'setFavorite',
      'setNoteTags',
      'setPinned',
    ])
    expect(rendererBoundary.settingsApiKeys).toEqual([
      'getAiSettings',
      'getDetailLayout',
      'saveAiSettings',
      'setDetailLayout',
      'testAiConnection',
    ])
    expect(rendererBoundary.csp).toContain("default-src 'self'")
    expect(rendererBoundary.csp).toContain('frame-src https://www.youtube-nocookie.com')
    expect(rendererBoundary.csp).not.toContain("'unsafe-inline'")
    expect(rendererBoundary.csp).not.toContain("'nonce-")
    expect(rendererBoundary.ipcRendererType).toBe('undefined')
    expect(rendererBoundary.processType).toBe('undefined')
    expect(rendererBoundary.requireType).toBe('undefined')
    expect(rendererBoundary.webviewCount).toBe(0)

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.setZoomLevel(0)
    })
    await window.mouse.move(400, 300)
    await window.keyboard.down('Control')
    await window.mouse.wheel(0, -120)
    await window.keyboard.up('Control')
    await expect
      .poll(() =>
        electronApp.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel() ?? 0,
        ),
      )
      .toBeGreaterThan(0)

    await window.keyboard.down('Control')
    await window.mouse.wheel(0, 120)
    await window.keyboard.up('Control')
    await expect
      .poll(() =>
        electronApp.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel() ?? 1,
        ),
      )
      .toBe(0)

    const contractRoundTrip = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      const created = await api.notes.create({ title: 'IPC smoke notu' })
      const listed = await api.notes.list()

      return { created, listed }
    })

    expect(contractRoundTrip.created).toMatchObject({
      ok: true,
      data: { title: 'IPC smoke notu' },
    })
    if (!contractRoundTrip.created.ok) {
      throw new Error('Create contract unexpectedly failed.')
    }
    const createdNoteId = contractRoundTrip.created.data.id
    expect(contractRoundTrip.listed).toMatchObject({ ok: true })
    if (!contractRoundTrip.listed.ok) {
      throw new Error('List contract unexpectedly failed.')
    }
    expect(contractRoundTrip.listed.data.some((note) => note.id === createdNoteId)).toBe(true)

    const xssTitle = '<img src=x onerror="globalThis.compromised=true">'
    await window.getByRole('button', { name: 'Yeni Not', exact: true }).click()
    await window.getByLabel('Not başlığı').fill(xssTitle)
    await window.getByRole('button', { name: 'Notu oluştur' }).click()
    await expect(window.getByRole('heading', { name: xssTitle })).toBeVisible()
    const xssProbe = await window.evaluate(() => ({
      injectedImageCount: document.querySelectorAll('img[src="x"]').length,
      compromised: (globalThis as typeof globalThis & { compromised?: boolean }).compromised,
    }))
    expect(xssProbe).toEqual({ injectedImageCount: 0, compromised: undefined })

    await window.getByRole('button', { name: 'AI ayarları' }).click()
    await expect(window.getByRole('heading', { name: 'AI yapılandırması' })).toBeVisible()
    await expect(window.getByLabel('Kayıtlı anahtar')).toHaveValue('Kayıtlı anahtar yok')
    await expect(window.getByRole('button', { name: 'Bağlantıyı test et' })).toBeDisabled()
    const fakeApiKey = 'sk-e2e-not-a-real-secret-value'
    await window.getByLabel('Yeni API anahtarı').fill(fakeApiKey)
    await window.getByRole('button', { name: 'AI ayarlarını kaydet' }).click()
    await expect(window.getByText('AI ayarları kaydedildi.')).toBeVisible()
    await expect(window.getByLabel('Kayıtlı anahtar')).toHaveValue('••••••••••••')
    await expect(window.getByLabel('Yeni API anahtarı')).toHaveValue('')
    expect(readFileSync(join(profilePath, 'secrets', 'openai-api-key.bin'), 'utf8')).not.toContain(
      fakeApiKey,
    )
    await window.getByRole('button', { name: 'Not panosuna dön' }).click()
    await expect(window.getByRole('heading', { name: 'WovenNote' })).toBeVisible()

    const permissionState = await window.evaluate(
      async () => (await navigator.permissions.query({ name: 'geolocation' })).state,
    )
    expect(permissionState).toBe('denied')

    const pdfProbe = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          webviewTag: false,
        },
      })
      try {
        const paragraphs = Array.from(
          { length: 260 },
          (_, index) => `<p>Sayfa taşması doğrulama satırı ${index + 1}</p>`,
        ).join('')
        const html = `<style>@page{size:A4;margin:18mm}p{font:12pt sans-serif}</style>${paragraphs}`
        await printWindow.loadURL(
          `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`,
        )
        const pdf = await printWindow.webContents.printToPDF({
          pageSize: 'A4',
          preferCSSPageSize: true,
          printBackground: true,
        })
        const pdfText = pdf.toString('latin1')
        return {
          header: pdf.subarray(0, 5).toString('ascii'),
          hasEof: pdf.subarray(-1_024).toString('ascii').includes('%%EOF'),
          pageCount: pdfText.match(/\/Type\s*\/Page\b/g)?.length ?? 0,
        }
      } finally {
        printWindow.destroy()
      }
    })
    expect(pdfProbe.header).toBe('%PDF-')
    expect(pdfProbe.hasEof).toBe(true)
    expect(pdfProbe.pageCount).toBeGreaterThan(1)

    const originalUrl = window.url()
    await window.evaluate(() => {
      globalThis.location.href = 'https://example.com/'
    })
    await window.waitForTimeout(200)
    expect(window.url()).toBe(originalUrl)

    await window.evaluate(() => {
      globalThis.open('https://example.com/', '_blank')
    })
    await expect.poll(() => electronApp.windows().length).toBe(1)
  } finally {
    await electronApp.close()
    rmSync(profilePath, { force: true, recursive: true })
  }
})

test('supports dark theme contrast and the main modal flow with keyboard focus', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-accessibility-e2e-'))
  const electronApp = await electron.launch({
    args: [`--user-data-dir=${profilePath}`, join(process.cwd(), 'out/main/index.js')],
    env: electronLaunchEnvironment(),
  })
  try {
    const window = await electronApp.firstWindow()
    const theme = window.getByRole('combobox', { name: 'Tema' })
    await theme.focus()
    await theme.press('End')
    await expect(theme).toHaveValue('dark')
    await expect(window.locator('html')).toHaveAttribute('data-theme', 'dark')
    const colors = await window.evaluate(() => {
      const body = getComputedStyle(document.body)
      return { foreground: body.color, background: body.backgroundColor }
    })
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5)

    const createButton = window.getByRole('button', { name: 'Yeni Not', exact: true })
    await createButton.focus()
    await createButton.press('Enter')
    const titleInput = window.getByLabel('Not başlığı')
    await expect(titleInput).toBeFocused()
    await titleInput.press('Shift+Tab')
    await expect(window.getByRole('button', { name: 'Notu oluştur' })).toBeFocused()
    await window.keyboard.press('Escape')
    await expect(createButton).toBeFocused()

    await createButton.press('Enter')
    await titleInput.pressSequentially('Klavye notu')
    await titleInput.press('Tab')
    await window.keyboard.press('Tab')
    await expect(window.getByRole('button', { name: 'Notu oluştur' })).toBeFocused()
    await window.keyboard.press('Enter')
    const openNote = window.getByRole('button', { name: 'Klavye notu notunu aç' })
    await openNote.focus()
    await openNote.press('Enter')
    await expect(window.getByRole('heading', { name: 'Not editörü' })).toBeVisible()
    const back = window.getByRole('button', { name: 'Panoya dön' })
    await back.focus()
    await back.press('Enter')
    await expect(window.getByRole('heading', { name: 'Klavye notu' })).toBeVisible()
  } finally {
    await electronApp.close()
    rmSync(profilePath, { recursive: true, force: true })
  }
})
