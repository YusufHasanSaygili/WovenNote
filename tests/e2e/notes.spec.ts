import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

import type { WovenNoteApi } from '../../src/shared/preload-api'
import { closeDatabase, openDatabase } from '../../src/main/database/database'
import { AttachmentRepository } from '../../src/main/repositories/attachment-repository'
import { NoteRepository } from '../../src/main/repositories/note-repository'
import { NoteVersionRepository } from '../../src/main/repositories/note-version-repository'

function electronLaunchEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined,
    ),
  )
}

function launchWithProfile(profilePath: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [`--user-data-dir=${profilePath}`, join(process.cwd(), 'out/main/index.js')],
    env: electronLaunchEnvironment(),
  })
}

async function closeWithoutRendererDialog(
  electronApp: ElectronApplication | undefined,
): Promise<void> {
  if (!electronApp) return
  await electronApp.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy()
  })
  await electronApp.close()
}

test('creates one note and restores it after restarting the app', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-e2e-profile-'))
  let electronApp: ElectronApplication | undefined
  let savedLayout:
    { gridX: number; gridY: number; gridWidth: number; gridHeight: number } | undefined
  let savedPanelRatio: number | undefined

  try {
    electronApp = await launchWithProfile(profilePath)
    let window = await electronApp.firstWindow()
    await expect(window.getByText('İlk notunu oluştur')).toBeVisible()

    await window.getByRole('button', { name: 'Yeni Not', exact: true }).click()
    await window.getByLabel('Not başlığı').fill('Kalıcı E2E notu')
    await window.getByRole('button', { name: 'Notu oluştur' }).evaluate((button) => {
      const htmlButton = button as HTMLButtonElement
      htmlButton.click()
      htmlButton.click()
    })

    await expect(window.getByRole('heading', { name: 'Kalıcı E2E notu' })).toHaveCount(1)

    await window.getByRole('button', { name: 'Kalıcı E2E notu işlemleri' }).click()
    const openCardMenu = window.getByRole('menu')
    await expect(openCardMenu.getByRole('menuitem', { name: 'Çöp kutusuna taşı' })).toBeVisible()
    await expect
      .poll(() =>
        openCardMenu.evaluate((menu) => {
          const card = menu.closest<HTMLElement>('.note-card')
          const gridItem = menu.closest<HTMLElement>('.note-grid-item')
          const heading = menu.closest<HTMLElement>('.note-card-heading')
          const timestamp = card?.querySelector<HTMLElement>('time')
          if (!card || !gridItem || !heading || !timestamp) return null

          return {
            cardOverflow: getComputedStyle(card).overflow,
            gridItemZIndex: Number(getComputedStyle(gridItem).zIndex),
            menuLayerZIndex: Number(getComputedStyle(heading).zIndex),
            menuExtendsPastCard:
              menu.getBoundingClientRect().bottom > card.getBoundingClientRect().bottom,
            menuIsScrollable: menu.scrollHeight > menu.clientHeight,
            timestampLayerZIndex: Number(getComputedStyle(timestamp).zIndex),
          }
        }),
      )
      .toEqual({
        cardOverflow: 'visible',
        gridItemZIndex: 20,
        menuLayerZIndex: 5,
        menuExtendsPastCard: true,
        menuIsScrollable: true,
        timestampLayerZIndex: 1,
      })
    await window.getByRole('menuitem', { name: 'Yeniden adlandır' }).click()
    await window.getByLabel('Not başlığı').fill('Yeniden adlandırılmış not')
    await window.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'Yeniden adlandırılmış not' })).toBeVisible()

    await window
      .getByRole('button', { name: 'Yeniden adlandırılmış not işlemleri', exact: true })
      .click()
    await window.getByRole('menuitem', { name: 'Çoğalt' }).click()
    await expect(
      window.getByRole('heading', { name: 'Yeniden adlandırılmış not (Kopya)' }),
    ).toBeVisible()

    await window
      .getByRole('button', { name: 'Yeniden adlandırılmış not işlemleri', exact: true })
      .click()
    await window.getByRole('menuitem', { name: 'Çöp kutusuna taşı' }).click()
    await window.getByRole('button', { name: 'İptal' }).click()
    await expect(
      window.getByRole('heading', { name: 'Yeniden adlandırılmış not', exact: true }),
    ).toBeVisible()

    await window
      .getByRole('button', { name: 'Yeniden adlandırılmış not (Kopya) işlemleri' })
      .click()
    await window.getByRole('menuitem', { name: 'Çöp kutusuna taşı' }).click()
    await window.getByRole('button', { name: 'Çöp kutusuna taşı', exact: true }).click()
    await expect(
      window.getByRole('heading', { name: 'Yeniden adlandırılmış not (Kopya)' }),
    ).toHaveCount(0)

    const initialLayout = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      const result = await api.notes.list()
      if (!result.ok) throw new Error(result.error.message)
      const note = result.data[0]
      if (!note) throw new Error('E2E note was not found.')
      return {
        gridX: note.gridX,
        gridY: note.gridY,
        gridWidth: note.gridWidth,
        gridHeight: note.gridHeight,
      }
    })
    const dragHandle = window.locator('.note-card-drag-handle').first()
    const dragBox = await dragHandle.boundingBox()
    if (!dragBox) throw new Error('Drag handle was not measurable.')
    await dragHandle.hover()
    await window.mouse.down()
    await window.mouse.move(
      dragBox.x + dragBox.width / 2 + 80,
      dragBox.y + dragBox.height / 2 + 32,
      {
        steps: 8,
      },
    )
    await expect(window.locator('.react-draggable-dragging')).toHaveCount(1)
    await window.mouse.move(dragBox.x + 230, dragBox.y + 75, { steps: 8 })
    await window.mouse.up()

    const resizeHandle = window.locator('.react-resizable-handle-se').first()
    const resizeBox = await resizeHandle.boundingBox()
    if (!resizeBox) throw new Error('Resize handle was not measurable.')
    await window.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
    await window.mouse.down()
    await window.mouse.move(
      resizeBox.x + resizeBox.width / 2 + 12,
      resizeBox.y + resizeBox.height / 2,
    )
    await expect(window.locator('.react-grid-item.resizing')).toHaveCount(1)
    await window.mouse.move(resizeBox.x + 125, resizeBox.y + resizeBox.height / 2, { steps: 8 })
    await window.mouse.up()

    await expect
      .poll(async () => {
        const result = await window.evaluate(async () => {
          const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
          return api.notes.list()
        })
        if (!result.ok || !result.data[0]) return initialLayout
        const note = result.data[0]
        return {
          gridX: note.gridX,
          gridY: note.gridY,
          gridWidth: note.gridWidth,
          gridHeight: note.gridHeight,
        }
      })
      .not.toEqual(initialLayout)
    const savedResult = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      return api.notes.list()
    })
    if (!savedResult.ok || !savedResult.data[0]) throw new Error('Saved layout was not found.')
    savedLayout = {
      gridX: savedResult.data[0].gridX,
      gridY: savedResult.data[0].gridY,
      gridWidth: savedResult.data[0].gridWidth,
      gridHeight: savedResult.data[0].gridHeight,
    }

    await window.getByRole('button', { name: 'Liste görünümü' }).focus()
    await window.keyboard.press('Enter')
    await expect(window.getByLabel('Notlar', { exact: true })).toHaveAttribute('data-view', 'list')

    await window.getByRole('button', { name: 'Menüyü daralt' }).focus()
    await window.keyboard.press('Enter')
    await expect(window.getByRole('button', { name: 'Menüyü genişlet' })).toBeVisible()

    await window.getByRole('button', { name: 'Yeniden adlandırılmış not notunu aç' }).click()
    await expect(window.getByText('AI henüz yapılandırılmadı')).toBeVisible()
    const separator = window.getByRole('separator', { name: 'Panel oranı' })
    await expect(separator).toHaveAttribute('aria-valuenow', '30')
    await separator.focus()
    await window.keyboard.press('ArrowRight')
    await window.keyboard.press('ArrowRight')
    await window.keyboard.press('ArrowRight')

    await expect
      .poll(async () => {
        const result = await window.evaluate(async () => {
          const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
          return api.settings.getDetailLayout()
        })
        return result.ok ? result.data.aiPanelPercentage : 30
      })
      .not.toBe(30)
    const panelResult = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      return api.settings.getDetailLayout()
    })
    if (!panelResult.ok) throw new Error(panelResult.error.message)
    savedPanelRatio = panelResult.data.aiPanelPercentage

    await window.getByLabel('Not başlığı').fill('İçerikli E2E notu')
    const editor = window.locator('.tiptap')
    await expect(window.getByLabel('Yazı tipi', { exact: true })).toBeVisible()
    await expect(window.getByLabel('Punto', { exact: true })).toBeVisible()
    await expect(window.getByRole('button', { name: 'Başlık 1' })).toHaveCount(0)
    await expect(window.getByRole('button', { name: 'Üstü çizili' })).toHaveCount(0)
    await editor.fill('Kalıcı editör başlığı')
    await editor.press('Control+a')
    await window.getByLabel('Yazı tipi', { exact: true }).selectOption('Georgia')
    await window.getByLabel('Punto', { exact: true }).selectOption('20pt')
    await expect(
      editor.locator('[data-font-family="Georgia"][data-font-size="20pt"]'),
    ).toContainText('Kalıcı editör başlığı')
    await editor.press('ArrowRight')
    await editor.press('Enter')
    await editor.pressSequentially('Kalıcı paragraf içeriği')
    await editor.press('Control+Shift+ArrowLeft')
    await expect(window.getByLabel('Seçili metin için AI işlemi')).toHaveCount(0)
    await editor.press('Control+b')
    await editor.press('Control+Shift+ArrowLeft')
    await editor.press('Control+i')
    await expect(editor.locator('strong').filter({ hasText: 'içeriği' })).toHaveCount(1)
    await expect(editor.locator('em').filter({ hasText: 'içeriği' })).toHaveCount(1)
    await editor.press('End')
    await editor.pressSequentially(' geçici')
    await expect(editor).toContainText('geçici')
    await editor.press('Control+z')
    await expect(editor).not.toContainText('geçici')
    await editor.press('End')
    await editor.press('Enter')
    await editor.pressSequentially('Kontrol maddesi')
    await window.getByRole('button', { name: 'Yapılacaklar listesi' }).click()
    await expect(editor.locator("ul[data-type='taskList']")).toBeVisible()
    await window.getByRole('button', { name: '3 × 3 tablo ekle' }).click()
    await expect(editor.locator('table')).toBeVisible()
    await editor.locator('th').first().click()
    await window.getByRole('button', { name: 'Satır ekle' }).click()
    await window.getByRole('button', { name: 'Sütun ekle' }).click()
    await expect(editor.locator('tr')).toHaveCount(4)
    await expect(editor.locator('tr').first().locator('th, td')).toHaveCount(4)

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(800, 600)
    })
    await expect
      .poll(() =>
        window
          .getByRole('toolbar', { name: 'Editör araçları' })
          .evaluate((toolbar) => toolbar.scrollWidth > toolbar.clientWidth),
      )
      .toBe(true)
    await window.getByRole('button', { name: '3 × 3 tablo ekle' }).scrollIntoViewIfNeeded()
    await expect(window.getByRole('button', { name: '3 × 3 tablo ekle' })).toBeVisible()

    await window.keyboard.press('Control+f')
    const searchInput = window.getByRole('searchbox', { name: 'Not içinde ara' })
    await searchInput.fill('kalıcı')
    await expect(window.getByText('1 / 2')).toBeVisible()
    await searchInput.press('Enter')
    await expect(window.getByText('2 / 2')).toBeVisible()
    await searchInput.press('Escape')
    await editor.press('Control+s')
    await expect(window.getByText('Kaydedildi', { exact: true })).toBeVisible()

    await window.getByRole('button', { name: 'Panoya dön' }).click()
    await expect(window.getByLabel('Notlar', { exact: true })).toHaveAttribute('data-view', 'list')
    await expect(window.getByText(/Kalıcı editör başlığı/)).toBeVisible()

    const boardSearch = window.getByRole('searchbox', { name: 'Notlarda ara' })
    await boardSearch.fill('İÇERİĞİ')
    await expect(window.getByRole('heading', { name: 'İçerikli E2E notu' })).toBeVisible()
    await boardSearch.fill('bulunmayan arama')
    await expect(window.getByRole('heading', { name: 'Aramayla eşleşen not yok' })).toBeVisible()
    await window.getByRole('button', { name: 'Aramayı temizle' }).click()
    await expect(window.getByRole('heading', { name: 'İçerikli E2E notu' })).toBeVisible()

    await window.getByRole('button', { name: 'İçerikli E2E notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Sabitle' }).click()
    await expect(window.getByText('Not sabitlendi.')).toBeVisible()
    await window.getByRole('button', { name: 'İçerikli E2E notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Favoriye ekle' }).click()
    await expect(window.getByText('Not favorilere eklendi.')).toBeVisible()
    await window.getByRole('button', { name: 'İçerikli E2E notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Etiketleri yönet' }).click()
    await window.getByLabel('Yeni etiket').fill('Kalıcı etiket')
    await window.getByLabel('Etiket rengi').selectOption('#7e22ce')
    await window.getByRole('button', { name: 'Etiket ekle' }).click()
    await expect(window.getByRole('checkbox', { name: 'Kalıcı etiket' })).toBeChecked()
    await window.getByRole('button', { name: 'Etiketleri kaydet' }).click()
    await expect(window.getByText('Not etiketleri güncellendi.')).toBeVisible()
    await boardSearch.fill('KALICI ETİKET')
    await expect(window.getByRole('heading', { name: 'İçerikli E2E notu' })).toBeVisible()
    await window.getByRole('button', { name: 'Arama alanını temizle' }).click()

    await closeWithoutRendererDialog(electronApp)
    electronApp = await launchWithProfile(profilePath)
    window = await electronApp.firstWindow()

    await expect(
      window.getByRole('heading', { name: 'İçerikli E2E notu', exact: true }),
    ).toHaveCount(1)
    await expect(window.getByText('1 not')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Liste görünümü' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(window.getByRole('button', { name: 'Menüyü genişlet' })).toBeVisible()
    await expect(window.getByText('Kalıcı etiket')).toBeVisible()
    await expect(window.getByTitle('Sabitlenmiş')).toBeVisible()
    await expect(window.getByTitle('Favori')).toBeVisible()
    await window.getByRole('button', { name: 'Menüyü genişlet' }).click()
    await window.getByRole('button', { name: 'Sabitlenenler' }).click()
    await expect(window.getByRole('heading', { name: 'İçerikli E2E notu' })).toBeVisible()
    await window.getByRole('button', { name: 'Favoriler' }).click()
    await expect(window.getByRole('heading', { name: 'İçerikli E2E notu' })).toBeVisible()
    const restoredResult = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      return api.notes.list()
    })
    if (!restoredResult.ok || !restoredResult.data[0]) {
      throw new Error('Restored layout was not found.')
    }
    expect({
      gridX: restoredResult.data[0].gridX,
      gridY: restoredResult.data[0].gridY,
      gridWidth: restoredResult.data[0].gridWidth,
      gridHeight: restoredResult.data[0].gridHeight,
    }).toEqual(savedLayout)

    await window.getByRole('button', { name: 'İçerikli E2E notu notunu aç' }).click()
    await expect(window.getByText('AI henüz yapılandırılmadı')).toBeVisible()
    await expect
      .poll(async () =>
        Number(
          await window
            .getByRole('separator', { name: 'Panel oranı' })
            .getAttribute('aria-valuenow'),
        ),
      )
      .toBeCloseTo(savedPanelRatio ?? 30, 1)
    await expect(window.locator('.tiptap')).toContainText('Kalıcı editör başlığı')
    await expect(window.locator('.tiptap')).toContainText('Kalıcı paragraf içeriği')
    await expect(window.locator('.tiptap strong').filter({ hasText: 'içeriği' })).toHaveCount(1)
    await expect(window.locator('.tiptap em').filter({ hasText: 'içeriği' })).toHaveCount(1)
    await expect(window.locator('.tiptap tr')).toHaveCount(4)
    await expect(window.locator('.tiptap tr').first().locator('th, td')).toHaveCount(4)
    await expect(window.locator(".tiptap ul[data-type='taskList']")).toContainText(
      'Kontrol maddesi',
    )
    await window.locator('.tiptap').press('Control+End')
    await window.locator('.tiptap').pressSequentially(' otomatik')
    await expect(window.getByText('Değişiklikler bekliyor', { exact: true })).toBeVisible()
    await expect(window.getByText('Kaydedildi', { exact: true })).toBeVisible()
  } finally {
    await closeWithoutRendererDialog(electronApp)
    rmSync(profilePath, { force: true, recursive: true })
  }
})

test('previews a version, restores it and keeps the current content as a checkpoint', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-version-e2e-'))
  const database = openDatabase(join(profilePath, 'wovennote.sqlite3'))
  const timestamp = '2026-07-28T18:00:00.000Z'
  new NoteRepository(database).insert({
    id: 'version-e2e-note',
    title: 'Sürüm E2E notu',
    preview: 'Güncel E2E içerik',
    searchText: 'Güncel E2E içerik',
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Güncel E2E içerik' }] }],
      },
    }),
    color: '#fff4bd',
    gridX: 0,
    gridY: 0,
    gridWidth: 3,
    gridHeight: 4,
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    deletedAt: null,
    lastOpenedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  new NoteVersionRepository(database).insert({
    id: 'version-e2e-old',
    noteId: 'version-e2e-note',
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eski E2E içerik' }] }],
      },
    }),
    reason: 'autosave',
    createdAt: timestamp,
  })
  closeDatabase(database)

  let electronApp: ElectronApplication | undefined
  try {
    electronApp = await launchWithProfile(profilePath)
    const window = await electronApp.firstWindow()
    await window.getByRole('button', { name: 'Sürüm E2E notu notunu aç' }).click()
    await expect(window.locator('.tiptap')).toContainText('Güncel E2E içerik')
    await window.getByRole('button', { name: 'Sürüm geçmişi' }).click()
    await expect(window.getByRole('region', { name: 'Sürüm önizlemesi' })).toContainText(
      'Eski E2E içerik',
    )
    await window.getByRole('button', { name: 'Bu sürüme geri dön' }).click()
    await expect(
      window.getByRole('alertdialog', { name: 'Bu sürüme geri dönülsün mü?' }),
    ).toBeVisible()
    await window.getByRole('button', { name: 'Geri yüklemeyi onayla' }).click()
    await expect(window.locator('.tiptap')).toContainText('Eski E2E içerik')

    const versions = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      return api.notes.listVersions({ noteId: 'version-e2e-note' })
    })
    expect(versions).toMatchObject({ ok: true })
    if (!versions.ok) throw new Error(versions.error.message)
    expect(versions.data.find((version) => version.reason === 'restore')).toMatchObject({
      reason: 'restore',
      preview: 'Güncel E2E içerik',
    })
  } finally {
    await closeWithoutRendererDialog(electronApp)
    rmSync(profilePath, { recursive: true, force: true })
  }
})

test('archives, trashes, restores and permanently deletes with confirmation', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-lifecycle-e2e-'))
  let electronApp: ElectronApplication | undefined
  try {
    electronApp = await launchWithProfile(profilePath)
    const window = await electronApp.firstWindow()
    await window.getByRole('button', { name: 'Yeni Not', exact: true }).click()
    await window.getByLabel('Not başlığı').fill('Yaşam döngüsü notu')
    await window.getByRole('button', { name: 'Notu oluştur' }).click()
    await expect(window.getByRole('heading', { name: 'Yaşam döngüsü notu' })).toBeVisible()

    await window.getByRole('button', { name: 'Yaşam döngüsü notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Arşivle' }).click()
    await expect(window.getByText('Not arşivlendi.')).toBeVisible()
    await expect(window.getByRole('heading', { name: 'Yaşam döngüsü notu' })).toHaveCount(0)
    await window.getByRole('button', { name: 'Arşiv' }).click()
    await expect(window.getByRole('heading', { name: 'Yaşam döngüsü notu' })).toBeVisible()
    await window.getByRole('button', { name: 'Arşivden çıkar' }).click()
    await expect(window.getByRole('heading', { name: 'Arşiv boş' })).toBeVisible()
    await window.getByRole('button', { name: 'Tüm notlara dön' }).click()

    await window.getByRole('button', { name: 'Yaşam döngüsü notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Çöp kutusuna taşı' }).click()
    await window.getByRole('button', { name: 'Çöp kutusuna taşı', exact: true }).click()
    await window.getByRole('button', { name: 'Çöp kutusu' }).click()
    await expect(window.getByRole('heading', { name: 'Yaşam döngüsü notu' })).toBeVisible()
    await window.getByRole('button', { name: 'Geri yükle' }).click()
    await expect(window.getByRole('heading', { name: 'Çöp kutusu boş' })).toBeVisible()
    await window.getByRole('button', { name: 'Tüm notlara dön' }).click()

    await window.getByRole('button', { name: 'Yaşam döngüsü notu işlemleri' }).click()
    await window.getByRole('menuitem', { name: 'Çöp kutusuna taşı' }).click()
    await window.getByRole('button', { name: 'Çöp kutusuna taşı', exact: true }).click()
    await window.getByRole('button', { name: 'Çöp kutusu' }).click()
    await window.getByRole('button', { name: 'Kalıcı sil' }).click()
    await expect(
      window.getByRole('alertdialog', { name: 'Not kalıcı olarak silinsin mi?' }),
    ).toBeVisible()
    await window.getByRole('button', { name: 'İptal' }).click()
    await expect(window.getByRole('heading', { name: 'Yaşam döngüsü notu' })).toBeVisible()
    await window.getByRole('button', { name: 'Kalıcı sil' }).click()
    await window.getByRole('button', { name: 'Kalıcı olarak sil' }).click()
    await expect(window.getByText('Not kalıcı olarak silindi.')).toBeVisible()
    await expect(window.getByRole('heading', { name: 'Çöp kutusu boş' })).toBeVisible()
  } finally {
    await closeWithoutRendererDialog(electronApp)
    rmSync(profilePath, { recursive: true, force: true })
  }
})

test('renders a stored JPEG and YouTube video block after reopening', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-image-e2e-profile-'))
  const attachmentId = 'attachment-e2e-001'
  const storedFileName = `${attachmentId}.jpg`
  const fileAttachmentId = 'file-e2e-001'
  const storedPdfFileName = `${fileAttachmentId}.pdf`
  const attachmentsRoot = join(profilePath, 'attachments')
  mkdirSync(attachmentsRoot, { recursive: true })
  const imageBytes = Buffer.from(
    '/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAUwNH//Z',
    'base64',
  )
  writeFileSync(join(attachmentsRoot, storedFileName), imageBytes)
  const pdfBytes = Buffer.from('%PDF-1.7\nWovenNote E2E')
  writeFileSync(join(attachmentsRoot, storedPdfFileName), pdfBytes)

  const database = openDatabase(join(profilePath, 'wovennote.sqlite3'))
  const timestamp = '2026-07-28T19:00:00.000Z'
  new NoteRepository(database).insert({
    id: 'note-image-e2e-001',
    title: 'Kalıcı görsel notu',
    preview: '',
    searchText: '',
    contentJson: JSON.stringify({
      documentVersion: 1,
      editor: 'tiptap',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Birinci' }] },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Taşınacak' }] }],
              },
            ],
          },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'İkinci' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Önce' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Orta' }] },
          {
            type: 'attachmentImage',
            attrs: {
              attachmentId,
              alt: 'Kalıcı görsel',
              alignment: 'center',
              width: 50,
            },
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Sonra' }] },
          { type: 'attachmentFile', attrs: { attachmentId: fileAttachmentId } },
          { type: 'youtubeVideo', attrs: { videoId: 'M7lc1UVf-VE' } },
        ],
      },
    }),
    color: '#fff4bd',
    gridX: 0,
    gridY: 0,
    gridWidth: 3,
    gridHeight: 4,
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    deletedAt: null,
    lastOpenedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  new AttachmentRepository(database).insert({
    id: attachmentId,
    noteId: 'note-image-e2e-001',
    blockId: null,
    originalFileName: 'kalıcı.jpg',
    storedFileName,
    relativePath: storedFileName,
    mimeType: 'image/jpeg',
    fileSize: imageBytes.length,
    width: 1,
    height: 1,
    createdAt: timestamp,
  })
  new AttachmentRepository(database).insert({
    id: fileAttachmentId,
    noteId: 'note-image-e2e-001',
    blockId: null,
    originalFileName: 'kalıcı-rapor.pdf',
    storedFileName: storedPdfFileName,
    relativePath: storedPdfFileName,
    mimeType: 'application/pdf',
    fileSize: pdfBytes.length,
    width: null,
    height: null,
    createdAt: timestamp,
  })
  closeDatabase(database)

  let electronApp: ElectronApplication | undefined
  try {
    for (let launchIndex = 0; launchIndex < 2; launchIndex += 1) {
      electronApp = await launchWithProfile(profilePath)
      const window = await electronApp.firstWindow()
      await expect(window.getByRole('heading', { name: 'Kalıcı görsel notu' })).toBeVisible()
      await window.getByRole('button', { name: 'Kalıcı görsel notu notunu aç' }).click()
      const image = window.getByRole('img', { name: 'Kalıcı görsel' })
      await expect(image).toBeVisible()
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBe(2)
      await expect(image).toHaveAttribute('src', `wovennote-attachment://media/${attachmentId}`)
      const youtubeFrame = window.getByTitle('YouTube videosu')
      await expect(youtubeFrame).toHaveAttribute(
        'src',
        'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1&rel=0&origin=https%3A%2F%2Fwovennote.local',
      )
      const youtubeBlock = window.locator('[data-youtube-video-id="M7lc1UVf-VE"]')
      await expect(window.getByText('kalıcı-rapor.pdf')).toBeVisible()
      await expect(window.getByRole('button', { name: 'Dış uygulamada aç' })).toBeEnabled()

      if (launchIndex === 0) {
        await window.evaluate(() => {
          const handle = [
            ...document.querySelectorAll<HTMLButtonElement>('.block-drag-handle'),
          ].find((candidate) =>
            candidate.getAttribute('aria-label')?.startsWith('YouTube videosu bloğunu taşı'),
          )
          const videoBlock = document.querySelector<HTMLElement>('[data-youtube-video-id]')
          const editor = document.querySelector<HTMLElement>('.tiptap')
          if (!handle || !videoBlock || !editor) {
            throw new Error('YouTube horizontal drag source or target was not found.')
          }
          const transfer = new DataTransfer()
          const videoBounds = videoBlock.getBoundingClientRect()
          const editorBounds = editor.getBoundingClientRect()
          handle.dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }),
          )
          videoBlock.dispatchEvent(
            new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              clientX: editorBounds.right - 10,
              clientY: videoBounds.top + videoBounds.height / 2,
              dataTransfer: transfer,
            }),
          )
          handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }))
        })
        await expect(youtubeBlock).toHaveClass(/alignment-right/)
        await window
          .getByRole('button', { name: /Görev listesi bloğunu taşı/ })
          .press('Alt+ArrowDown')
        await window.evaluate(() => {
          const handle = [
            ...document.querySelectorAll<HTMLButtonElement>('.block-drag-handle'),
          ].find((candidate) =>
            candidate.getAttribute('aria-label')?.startsWith('Görsel bloğunu taşı'),
          )
          const target = [...document.querySelectorAll('p')].find(
            (paragraph) => paragraph.textContent === 'Orta',
          )
          if (!handle || !target) throw new Error('Drag source or target was not found.')
          const transfer = new DataTransfer()
          const bounds = target.getBoundingClientRect()
          handle.dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }),
          )
          target.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              clientX: bounds.left + bounds.width / 2,
              clientY: bounds.top + bounds.height / 2,
              dataTransfer: transfer,
            }),
          )
          target.dispatchEvent(
            new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              clientX: bounds.left + bounds.width / 2,
              clientY: bounds.top + bounds.height / 2,
              dataTransfer: transfer,
            }),
          )
          handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }))
        })
        await window.locator('.tiptap').press('Control+s')
        await expect(window.getByText('Kaydedildi', { exact: true })).toBeVisible()
      } else {
        await expect(youtubeBlock).toHaveClass(/alignment-right/)
        const blockTypes = await window.evaluate(async () => {
          const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
          const result = await api.notes.list()
          if (!result.ok) throw new Error(result.error.message)
          const note = result.data.find((item) => item.id === 'note-image-e2e-001')
          if (!note) throw new Error('Reordered note was not found.')
          const envelope = JSON.parse(note.contentJson) as {
            content: { content: Array<{ type: string }> }
          }
          return envelope.content.content.map((block) => block.type)
        })
        expect(blockTypes).toEqual([
          'heading',
          'heading',
          'taskList',
          'paragraph',
          'attachmentImage',
          'paragraph',
          'paragraph',
          'attachmentFile',
          'youtubeVideo',
        ])
      }

      await closeWithoutRendererDialog(electronApp)
      electronApp = undefined
    }
  } finally {
    await closeWithoutRendererDialog(electronApp)
    rmSync(profilePath, { recursive: true, force: true })
  }
})

test('adds a real .jpg through the picker, stores it and restores it after restart', async () => {
  const profilePath = mkdtempSync(join(tmpdir(), 'wovennote-jpg-picker-profile-'))
  const sourceRoot = mkdtempSync(join(tmpdir(), 'wovennote-jpg-picker-source-'))
  const sourcePath = join(sourceRoot, 'Windows-gerçek-fotoğraf.JPG')
  const imageBytes = Buffer.from(
    '/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAUwNH//Z',
    'base64',
  )
  writeFileSync(sourcePath, imageBytes)

  let electronApp: ElectronApplication | undefined
  try {
    electronApp = await launchWithProfile(profilePath)
    let window = await electronApp.firstWindow()
    await electronApp.evaluate(({ dialog }, selectedPath) => {
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: async (...args: unknown[]) => {
          const options = args.at(-1) as { filters?: Array<{ extensions?: string[] }> } | undefined
          if (!options?.filters?.[0]?.extensions?.includes('jpg')) {
            throw new Error('The Windows image picker does not include .jpg.')
          }
          return { canceled: false, filePaths: [selectedPath] }
        },
      })
    }, sourcePath)

    await window.getByRole('button', { name: 'Yeni Not', exact: true }).click()
    await window.getByLabel('Not başlığı').fill('Gerçek JPG seçim notu')
    await window.getByRole('button', { name: 'Notu oluştur' }).click()
    await window.getByRole('button', { name: 'Gerçek JPG seçim notu notunu aç' }).click()
    await window.getByRole('button', { name: 'Resim ekle' }).click()

    let image = window.locator('.attachment-image img')
    await expect(image).toBeVisible()
    const imageWidthLabel = window.locator('.attachment-image-control-row > span').first()
    await expect(imageWidthLabel).toHaveText('50%')
    await expect
      .poll(() => imageWidthLabel.evaluate((element) => getComputedStyle(element).color))
      .toBe('rgb(17, 17, 17)')
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBe(2)
    await expect(image).toHaveAttribute('src', /^wovennote-attachment:\/\/media\/[a-zA-Z0-9-]+$/)
    await window.locator('.tiptap').press('Control+s')
    await expect(window.getByText('Kaydedildi', { exact: true })).toBeVisible()

    const storedImage = await window.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { wovenNote: WovenNoteApi }).wovenNote
      const result = await api.notes.list()
      if (!result.ok) throw new Error(result.error.message)
      const note = result.data.find((candidate) => candidate.title === 'Gerçek JPG seçim notu')
      if (!note) throw new Error('The JPG note was not stored.')
      const envelope = JSON.parse(note.contentJson) as {
        content: { content: Array<{ attrs?: { attachmentId?: string }; type: string }> }
      }
      return envelope.content.content.find((block) => block.type === 'attachmentImage')
    })
    expect(storedImage?.attrs?.attachmentId).toMatch(/^[a-zA-Z0-9-]+$/)

    await closeWithoutRendererDialog(electronApp)
    electronApp = undefined
    rmSync(sourceRoot, { recursive: true, force: true })

    electronApp = await launchWithProfile(profilePath)
    window = await electronApp.firstWindow()
    await window.getByRole('button', { name: 'Gerçek JPG seçim notu notunu aç' }).click()
    image = window.locator('.attachment-image img')
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBe(2)
  } finally {
    await closeWithoutRendererDialog(electronApp)
    rmSync(profilePath, { recursive: true, force: true })
    rmSync(sourceRoot, { recursive: true, force: true })
  }
})
