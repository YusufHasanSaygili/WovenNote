import { randomUUID } from 'node:crypto'
import { constants as fileSystemConstants } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

import type Database from 'better-sqlite3'

import {
  BackupManifestSchema,
  type BackupConflictStrategy,
  type BackupManifest,
  type CreateBackupOutcome,
  type InspectBackupOutcome,
  type RestoreBackupOutcome,
} from '../../shared/schemas/backup-contracts'
import { BackupRepository } from '../repositories/backup-repository'
import {
  BackupArchiveError,
  decodeBackupArchive,
  encodeBackupArchive,
  sha256Hex,
} from './backup-archive'

const BACKUP_EXTENSION = '.wovennote-backup'
const MAX_BACKUP_ARCHIVE_BYTES = 512 * 1024 * 1024
const IMPORT_SESSION_LIFETIME_MS = 10 * 60 * 1_000

interface SelectedBackup {
  readonly expiresAt: number
  readonly manifest: BackupManifest
  readonly media: ReadonlyMap<string, Uint8Array>
}

export interface BackupServiceDependencies {
  readonly chooseBackupDestination: () => Promise<string | null>
  readonly chooseBackupSource: () => Promise<string | null>
  readonly createId?: () => string
  readonly installStagedFile?: (sourcePath: string, destinationPath: string) => Promise<void>
  readonly now?: () => Date
  readonly writeBackupFile?: (filePath: string, content: Uint8Array) => Promise<void>
}

export class BackupServiceError extends Error {
  constructor(
    readonly publicMessage: string,
    cause?: unknown,
  ) {
    super(publicMessage, { cause })
    this.name = 'BackupServiceError'
  }
}

function controlledPath(root: string, fileName: string): string {
  const resolvedRoot = resolve(root)
  const destination = resolve(resolvedRoot, fileName)
  const fromRoot = relative(resolvedRoot, destination)
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new BackupServiceError('Yedek medya yolu güvenli değil.')
  }
  return destination
}

function backupDestination(filePath: string): string {
  return filePath.toLocaleLowerCase('en-US').endsWith(BACKUP_EXTENSION)
    ? filePath
    : `${filePath}${BACKUP_EXTENSION}`
}

export class BackupService {
  private readonly createId: () => string
  private readonly imports = new Map<string, SelectedBackup>()
  private readonly installStagedFile: (sourcePath: string, destinationPath: string) => Promise<void>
  private readonly now: () => Date
  private readonly repository: BackupRepository
  private readonly writeBackupFile: (filePath: string, content: Uint8Array) => Promise<void>

  constructor(
    private readonly database: Database.Database,
    private readonly attachmentRoot: string,
    private readonly stagingRoot: string,
    private readonly dependencies: BackupServiceDependencies,
  ) {
    this.repository = new BackupRepository(database)
    this.createId = dependencies.createId ?? randomUUID
    this.now = dependencies.now ?? (() => new Date())
    this.installStagedFile =
      dependencies.installStagedFile ??
      ((sourcePath, destinationPath) =>
        copyFile(sourcePath, destinationPath, fileSystemConstants.COPYFILE_EXCL))
    this.writeBackupFile =
      dependencies.writeBackupFile ?? ((filePath, content) => writeFile(filePath, content))
  }

  async createBackup(): Promise<CreateBackupOutcome> {
    let selectedPath: string | null
    try {
      selectedPath = await this.dependencies.chooseBackupDestination()
    } catch (error) {
      throw new BackupServiceError('Yedek kaydetme penceresi açılamadı.', error)
    }
    if (!selectedPath) return { status: 'cancelled' }

    try {
      const snapshot = this.repository.exportSnapshot()
      const media = new Map<string, Uint8Array>()
      const attachments = []
      for (const attachment of snapshot.attachments) {
        const filePath = controlledPath(this.attachmentRoot, attachment.relativePath)
        const metadata = await stat(filePath)
        if (!metadata.isFile() || metadata.size !== attachment.fileSize) {
          throw new Error('Attachment metadata does not match the stored file.')
        }
        const data = await readFile(filePath)
        const archivePath = `media/${attachment.storedFileName}`
        media.set(archivePath, data)
        attachments.push({
          ...attachment,
          archivePath,
          sha256: sha256Hex(data),
        })
      }
      const manifest = BackupManifestSchema.parse({
        format: 'wovennote-backup',
        backupVersion: 1,
        schemaVersion: 7,
        createdAt: this.now().toISOString(),
        data: { ...snapshot, attachments },
      })
      const archive = encodeBackupArchive(manifest, media)
      const destination = backupDestination(selectedPath)
      await this.writeBackupFile(destination, archive)
      return {
        status: 'saved',
        fileName: basename(destination),
        bytesWritten: archive.byteLength,
        notes: manifest.data.notes.length,
        attachments: manifest.data.attachments.length,
      }
    } catch (error) {
      throw new BackupServiceError(
        'Tam yedek oluşturulamadı. Medya dosyalarını ve hedef klasör izinlerini kontrol edin.',
        error,
      )
    }
  }

  async inspectBackup(): Promise<InspectBackupOutcome> {
    let selectedPath: string | null
    try {
      selectedPath = await this.dependencies.chooseBackupSource()
    } catch (error) {
      throw new BackupServiceError('Yedek seçme penceresi açılamadı.', error)
    }
    if (!selectedPath) return { status: 'cancelled' }

    try {
      const metadata = await stat(selectedPath)
      if (!metadata.isFile() || metadata.size > MAX_BACKUP_ARCHIVE_BYTES) {
        throw new BackupArchiveError('Yedek dosyası güvenli boyut sınırını aşıyor.')
      }
      const decoded = decodeBackupArchive(await readFile(selectedPath))
      const importToken = randomUUID()
      this.imports.clear()
      this.imports.set(importToken, {
        ...decoded,
        expiresAt: this.now().getTime() + IMPORT_SESSION_LIFETIME_MS,
      })
      return {
        status: 'ready',
        importToken,
        summary: {
          createdAt: decoded.manifest.createdAt,
          notes: decoded.manifest.data.notes.length,
          attachments: decoded.manifest.data.attachments.length,
          chatMessages: decoded.manifest.data.chatMessages.length,
          noteConflicts: this.repository.countNoteConflicts(decoded.manifest),
        },
      }
    } catch (error) {
      throw new BackupServiceError('Seçilen yedek geçersiz, bozuk veya desteklenmiyor.', error)
    }
  }

  async restoreBackup(
    importToken: string,
    conflictStrategy: BackupConflictStrategy,
  ): Promise<RestoreBackupOutcome> {
    const selected = this.imports.get(importToken)
    this.imports.delete(importToken)
    if (!selected || selected.expiresAt < this.now().getTime()) {
      throw new BackupServiceError(
        'Yedek geri yükleme oturumunun süresi doldu. Dosyayı yeniden seçin.',
      )
    }

    const prepared = this.repository.prepareImport(
      selected.manifest,
      conflictStrategy,
      this.createId,
    )
    let stagingDirectory: string | null = null
    const installedPaths: string[] = []
    let transactionOpen = false
    try {
      await mkdir(this.stagingRoot, { recursive: true })
      stagingDirectory = await mkdtemp(join(this.stagingRoot, 'restore-'))
      for (const attachment of prepared.attachments) {
        const data = selected.media.get(attachment.sourceArchivePath)
        if (!data) throw new Error('Validated media entry is missing.')
        const stagedPath = controlledPath(stagingDirectory, attachment.record.storedFileName)
        await writeFile(stagedPath, data, { flag: 'wx' })
      }

      await mkdir(this.attachmentRoot, { recursive: true })
      this.database.exec('BEGIN IMMEDIATE')
      transactionOpen = true
      this.repository.applyPreparedImport(prepared)
      for (const attachment of prepared.attachments) {
        const sourcePath = controlledPath(stagingDirectory, attachment.record.storedFileName)
        const destinationPath = controlledPath(this.attachmentRoot, attachment.record.relativePath)
        installedPaths.push(destinationPath)
        await this.installStagedFile(sourcePath, destinationPath)
      }
      this.database.exec('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) {
        try {
          this.database.exec('ROLLBACK')
        } catch {
          // Preserve the original error; the database connection remains responsible for recovery.
        }
      }
      await Promise.all(installedPaths.map((filePath) => unlink(filePath).catch(() => undefined)))
      throw new BackupServiceError(
        'Yedek geri yüklenemedi. Yapılan değişiklikler geri alındı.',
        error,
      )
    } finally {
      if (stagingDirectory) {
        const resolvedStagingRoot = resolve(this.stagingRoot)
        const resolvedDirectory = resolve(stagingDirectory)
        const fromRoot = relative(resolvedStagingRoot, resolvedDirectory)
        if (fromRoot && !fromRoot.startsWith('..') && !isAbsolute(fromRoot)) {
          await rm(resolvedDirectory, { recursive: true, force: true }).catch(() => undefined)
        }
      }
    }

    const installedNames = new Set(
      prepared.attachments.map((attachment) => attachment.record.relativePath),
    )
    await Promise.all(
      prepared.obsoleteAttachmentPaths
        .filter((path) => !installedNames.has(path))
        .map((path) => unlink(controlledPath(this.attachmentRoot, path)).catch(() => undefined)),
    )
    return {
      status: 'restored',
      notesImported: prepared.notes.length,
      notesSkipped: prepared.notesSkipped,
      attachmentsImported: prepared.attachments.length,
    }
  }
}
