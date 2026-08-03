import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, stat, writeFile } from 'node:fs/promises'

import type Database from 'better-sqlite3'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  protocol,
  safeStorage,
  session,
  shell,
} from 'electron'

import { ATTACHMENT_PROTOCOL, registerAttachmentProtocol } from './attachment-protocol'
import { closeDatabase, openDatabase } from './database/database'
import { registerAttachmentIpcHandlers } from './ipc/attachment-ipc'
import { registerAiChatIpcHandlers } from './ipc/ai-chat-ipc'
import { registerAiResponseActionIpcHandlers } from './ipc/ai-response-action-ipc'
import { registerInlineAiIpcHandlers } from './ipc/inline-ai-ipc'
import { registerNoteIpcHandlers } from './ipc/note-ipc'
import { registerNoteExportIpcHandlers } from './ipc/note-export-ipc'
import { registerBackupIpcHandlers } from './ipc/backup-ipc'
import { registerOrganizationIpcHandlers } from './ipc/organization-ipc'
import { registerSettingsIpcHandlers } from './ipc/settings-ipc'
import { AttachmentRepository } from './repositories/attachment-repository'
import { ChatRepository } from './repositories/chat-repository'
import { NoteRepository } from './repositories/note-repository'
import { NoteVersionRepository } from './repositories/note-version-repository'
import { TagRepository } from './repositories/tag-repository'
import { SettingsRepository } from './repositories/settings-repository'
import { configureSessionSecurity, hardenWebContents } from './security'
import { AttachmentService } from './services/attachment-service'
import { AiChatService } from './services/ai-chat-service'
import { AiResponseActionService } from './services/ai-response-action-service'
import { AiSettingsService } from './services/ai-settings-service'
import { EncryptedFileSecretStore } from './services/encrypted-secret-store'
import { NoteService } from './services/note-service'
import { NoteExportService } from './services/note-export-service'
import { OrganizationService } from './services/organization-service'
import { InlineAiService } from './services/inline-ai-service'
import { OpenAiConnectionTester } from './services/openai-connection-tester'
import { OpenAiResponseClient } from './services/openai-response-client'
import { SettingsService } from './services/settings-service'
import { createMainWindowOptions } from './window-options'
import { printHtmlToPdf } from './electron-pdf-printer'
import { NotePdfRenderer } from './services/note-pdf-renderer'
import { BackupService } from './services/backup-service'
import { migrateLegacyUserData } from './brand-data-migration'

const APP_ID = 'com.yusufhasan.wovennote'
const PRODUCT_NAME = 'WovenNote'
const LEGACY_BACKUP_FILE_EXTENSION = ['note', 'gpt-backup'].join('')
const MAX_PDF_IMAGE_BYTES = 25 * 1024 * 1024
const PDF_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
let applicationDatabase: Database.Database | undefined
let removeAiChatIpcHandlers: (() => void) | undefined
let removeAiResponseActionIpcHandlers: (() => void) | undefined
let removeInlineAiIpcHandlers: (() => void) | undefined
let removeAttachmentIpcHandlers: (() => void) | undefined
let removeAttachmentProtocol: (() => void) | undefined
let removeNoteIpcHandlers: (() => void) | undefined
let removeNoteExportIpcHandlers: (() => void) | undefined
let removeBackupIpcHandlers: (() => void) | undefined
let removeOrganizationIpcHandlers: (() => void) | undefined
let removeSettingsIpcHandlers: (() => void) | undefined

function rendererUrl(): string {
  const developmentUrl = process.env['ELECTRON_RENDERER_URL']

  if (developmentUrl) {
    return developmentUrl
  }

  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

function createMainWindow(trustedRendererUrl: string): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js')
  const iconPath = join(__dirname, '../../build/icon.png')
  const window = new BrowserWindow(createMainWindowOptions(preloadPath, iconPath))

  hardenWebContents(window.webContents, trustedRendererUrl)

  window.once('ready-to-show', () => {
    window.show()
  })

  void window.loadURL(trustedRendererUrl)

  return window
}

app.setName(PRODUCT_NAME)

protocol.registerSchemesAsPrivileged([
  {
    scheme: ATTACHMENT_PROTOCOL,
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true },
  },
])

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

app.whenReady().then(async () => {
  const userDataDirectory = app.getPath('userData')
  try {
    const usesExplicitProfile = process.argv.some((argument) =>
      argument.toLocaleLowerCase('en-US').startsWith('--user-data-dir='),
    )
    if (app.isPackaged && !usesExplicitProfile) {
      await migrateLegacyUserData(app.getPath('appData'), userDataDirectory)
    }
    applicationDatabase = openDatabase(join(userDataDirectory, 'wovennote.sqlite3'))
  } catch {
    dialog.showErrorBox(
      'WovenNote başlatılamadı',
      'Yerel veritabanı açılamadı. Disk alanını ve klasör izinlerini kontrol edip tekrar deneyin.',
    )
    app.quit()
    return
  }

  const noteRepository = new NoteRepository(applicationDatabase)
  const attachmentRoot = join(userDataDirectory, 'attachments')
  const attachmentService = new AttachmentService(
    new AttachmentRepository(applicationDatabase),
    noteRepository,
    attachmentRoot,
    {
      chooseFile: async (accept) => {
        const filter = {
          image: {
            name: 'JPG/JPEG, PNG, GIF ve WebP',
            extensions: ['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'gif', 'webp'],
          },
          video: { name: 'Yerel video', extensions: ['mp4', 'webm'] },
          file: {
            name: 'PDF, Office veya metin',
            extensions: ['pdf', 'zip', 'docx', 'xlsx', 'pptx', 'txt', 'md', 'csv', 'json'],
          },
          all: {
            name: 'Desteklenen dosyalar',
            extensions: [
              'png',
              'jpg',
              'jpeg',
              'jpe',
              'jfif',
              'gif',
              'webp',
              'pdf',
              'mp4',
              'webm',
              'zip',
              'docx',
              'xlsx',
              'pptx',
              'txt',
              'md',
              'csv',
              'json',
            ],
          },
        }[accept]
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [filter],
        })
        return result.canceled ? null : (result.filePaths[0] ?? null)
      },
      openPath: (filePath) => shell.openPath(filePath),
    },
  )
  const noteService = new NoteService(noteRepository, {
    cleanupAttachmentFiles: (relativePaths) => attachmentService.deleteOrphanedFiles(relativePaths),
    versionRepository: new NoteVersionRepository(applicationDatabase),
  })
  removeAttachmentProtocol = registerAttachmentProtocol(protocol, attachmentService)
  removeAttachmentIpcHandlers = registerAttachmentIpcHandlers(ipcMain, attachmentService)
  removeNoteIpcHandlers = registerNoteIpcHandlers(ipcMain, noteService)
  const pdfRenderer = new NotePdfRenderer({
    printHtml: printHtmlToPdf,
    resolveImageDataUrl: async (attachmentId) => {
      const stored = attachmentService.resolveStoredFile(attachmentId)
      if (!stored || !PDF_IMAGE_MIME_TYPES.has(stored.mimeType)) return null
      try {
        const metadata = await stat(stored.filePath)
        if (!metadata.isFile() || metadata.size > MAX_PDF_IMAGE_BYTES) return null
        const data = await readFile(stored.filePath)
        return `data:${stored.mimeType};base64,${data.toString('base64')}`
      } catch {
        return null
      }
    },
  })
  removeNoteExportIpcHandlers = registerNoteExportIpcHandlers(
    ipcMain,
    new NoteExportService(noteRepository, {
      chooseDestination: async ({ defaultFileName, extensions, formatName }) => {
        const result = await dialog.showSaveDialog({
          title: 'Notu dışa aktar',
          defaultPath: join(app.getPath('documents'), defaultFileName),
          filters: [{ name: formatName, extensions: [...extensions] }],
          properties: ['showOverwriteConfirmation'],
        })
        return { cancelled: result.canceled, filePath: result.filePath }
      },
      renderPdf: (note) => pdfRenderer.render(note),
      writeFile: (filePath, content) => writeFile(filePath, content),
    }),
  )
  removeBackupIpcHandlers = registerBackupIpcHandlers(
    ipcMain,
    new BackupService(
      applicationDatabase,
      attachmentRoot,
      join(userDataDirectory, 'import-staging'),
      {
        chooseBackupDestination: async () => {
          const date = new Date().toISOString().slice(0, 10)
          const result = await dialog.showSaveDialog({
            title: 'Tam yedek oluştur',
            defaultPath: join(app.getPath('documents'), `WovenNote-yedek-${date}.wovennote-backup`),
            filters: [{ name: 'WovenNote tam yedeği', extensions: ['wovennote-backup'] }],
            properties: ['showOverwriteConfirmation'],
          })
          return result.canceled ? null : (result.filePath ?? null)
        },
        chooseBackupSource: async () => {
          const result = await dialog.showOpenDialog({
            title: 'WovenNote yedeğini seç',
            properties: ['openFile'],
            filters: [
              {
                name: 'WovenNote tam yedeği',
                extensions: ['wovennote-backup', LEGACY_BACKUP_FILE_EXTENSION],
              },
            ],
          })
          return result.canceled ? null : (result.filePaths[0] ?? null)
        },
      },
    ),
  )
  removeOrganizationIpcHandlers = registerOrganizationIpcHandlers(
    ipcMain,
    new OrganizationService(noteRepository, new TagRepository(applicationDatabase)),
  )
  const settingsRepository = new SettingsRepository(applicationDatabase)
  const aiSettingsService = new AiSettingsService(
    settingsRepository,
    new EncryptedFileSecretStore(join(userDataDirectory, 'secrets', 'openai-api-key.bin'), {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plainText) => safeStorage.encryptString(plainText),
      decrypt: (encrypted) => safeStorage.decryptString(encrypted),
    }),
    new OpenAiConnectionTester(),
  )
  removeSettingsIpcHandlers = registerSettingsIpcHandlers(
    ipcMain,
    new SettingsService(settingsRepository),
    aiSettingsService,
  )
  removeAiChatIpcHandlers = registerAiChatIpcHandlers(
    ipcMain,
    new AiChatService(
      new ChatRepository(applicationDatabase),
      noteRepository,
      aiSettingsService,
      new OpenAiResponseClient(),
    ),
  )
  removeAiResponseActionIpcHandlers = registerAiResponseActionIpcHandlers(
    ipcMain,
    new AiResponseActionService(
      new ChatRepository(applicationDatabase),
      noteRepository,
      noteService,
      {
        writeClipboard: (text) => clipboard.writeText(text),
      },
    ),
  )
  removeInlineAiIpcHandlers = registerInlineAiIpcHandlers(
    ipcMain,
    new InlineAiService(noteRepository, aiSettingsService, new OpenAiResponseClient()),
  )

  const trustedRendererUrl = rendererUrl()
  configureSessionSecurity(session.defaultSession, trustedRendererUrl)
  createMainWindow(trustedRendererUrl)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(trustedRendererUrl)
    }
  })
})

app.on('before-quit', () => {
  removeInlineAiIpcHandlers?.()
  removeInlineAiIpcHandlers = undefined
  removeAiResponseActionIpcHandlers?.()
  removeAiResponseActionIpcHandlers = undefined
  removeAiChatIpcHandlers?.()
  removeAiChatIpcHandlers = undefined
  removeAttachmentProtocol?.()
  removeAttachmentProtocol = undefined
  removeAttachmentIpcHandlers?.()
  removeAttachmentIpcHandlers = undefined
  removeNoteIpcHandlers?.()
  removeNoteIpcHandlers = undefined
  removeNoteExportIpcHandlers?.()
  removeNoteExportIpcHandlers = undefined
  removeBackupIpcHandlers?.()
  removeBackupIpcHandlers = undefined
  removeOrganizationIpcHandlers?.()
  removeOrganizationIpcHandlers = undefined
  removeSettingsIpcHandlers?.()
  removeSettingsIpcHandlers = undefined
  closeDatabase(applicationDatabase)
  applicationDatabase = undefined
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
