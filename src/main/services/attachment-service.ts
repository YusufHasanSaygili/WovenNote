import { randomUUID } from 'node:crypto'
import { constants as fileSystemConstants } from 'node:fs'
import { copyFile, mkdir, open, stat, unlink } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'

import type {
  Attachment,
  AttachmentAccept,
  AttachmentIdInput,
  PickAttachmentInput,
  PickAttachmentOutcome,
} from '../../shared/schemas/attachment-contracts'
import type { AttachmentRecord, AttachmentRepository } from '../repositories/attachment-repository'
import type { NoteRepository } from '../repositories/note-repository'

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024

const SUPPORTED_TYPE_DESCRIPTION = 'PNG, JPEG, GIF, WebP, PDF, MP4, WebM, ZIP, Office veya metin'
const TEXT_EXTENSIONS = new Set(['.csv', '.json', '.md', '.txt'])
const ZIP_MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
})

export class AttachmentStorageError extends Error {
  constructor(
    readonly publicMessage: string,
    cause?: unknown,
  ) {
    super(publicMessage, { cause })
    this.name = 'AttachmentStorageError'
  }
}

export interface AttachmentServiceDependencies {
  readonly chooseFile: (accept: AttachmentAccept) => Promise<string | null>
  readonly createId?: () => string
  readonly maxAttachmentBytes?: number
  readonly now?: () => Date
  readonly openPath?: (filePath: string) => Promise<string>
}

function startsWithBytes(buffer: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte)
}

function isText(buffer: Buffer): boolean {
  if (buffer.length === 0 || buffer.includes(0)) return false
  return !buffer.toString('utf8').includes('\uFFFD')
}

function detectMimeType(extension: string, header: Buffer): string | null {
  if (
    extension === '.png' &&
    startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png'
  }
  if (
    ['.jpe', '.jpeg', '.jfif', '.jpg'].includes(extension) &&
    startsWithBytes(header, [0xff, 0xd8, 0xff])
  ) {
    return 'image/jpeg'
  }
  if (
    extension === '.gif' &&
    ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString('ascii'))
  ) {
    return 'image/gif'
  }
  if (
    extension === '.webp' &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (extension === '.pdf' && header.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf'
  }
  if (extension === '.mp4' && header.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'video/mp4'
  }
  if (extension === '.webm' && startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3])) {
    return 'video/webm'
  }
  if (ZIP_MIME_BY_EXTENSION[extension] && startsWithBytes(header, [0x50, 0x4b])) {
    return ZIP_MIME_BY_EXTENSION[extension]
  }
  if (TEXT_EXTENSIONS.has(extension) && isText(header)) {
    return extension === '.json' ? 'application/json' : 'text/plain'
  }

  return null
}

export function sanitizeAttachmentFileName(fileName: string): string {
  const normalized = basename(fileName)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '_')
  const withoutControls = Array.from(normalized, (character) =>
    character.codePointAt(0)! < 32 ? '_' : character,
  ).join('')
  const sanitized = withoutControls.replace(/^\.+/, '').replace(/\s+/g, ' ').trim().slice(0, 160)

  return sanitized || 'dosya'
}

function controlledDestination(storageRoot: string, storedFileName: string): string {
  const resolvedRoot = resolve(storageRoot)
  const destination = resolve(resolvedRoot, storedFileName)
  const pathFromRoot = relative(resolvedRoot, destination)

  if (!pathFromRoot || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new AttachmentStorageError('Dosya için güvenli bir saklama yolu oluşturulamadı.')
  }

  return destination
}

async function readHeader(filePath: string, size: number): Promise<Buffer> {
  const file = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(Math.min(size, 4096))
    const { bytesRead } = await file.read(header, 0, header.length, 0)
    return header.subarray(0, bytesRead)
  } finally {
    await file.close()
  }
}

function publicAttachment(record: AttachmentRecord): Attachment {
  return {
    id: record.id,
    noteId: record.noteId,
    blockId: record.blockId,
    originalFileName: record.originalFileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    width: record.width,
    height: record.height,
    createdAt: record.createdAt,
  }
}

export class AttachmentService {
  private readonly createId: () => string
  private readonly maxAttachmentBytes: number
  private readonly now: () => Date

  constructor(
    private readonly repository: AttachmentRepository,
    private readonly noteRepository: NoteRepository,
    private readonly storageRoot: string,
    private readonly dependencies: AttachmentServiceDependencies,
  ) {
    this.createId = dependencies.createId ?? randomUUID
    this.maxAttachmentBytes = dependencies.maxAttachmentBytes ?? MAX_ATTACHMENT_BYTES
    this.now = dependencies.now ?? (() => new Date())
  }

  async pickAndStore(input: PickAttachmentInput): Promise<PickAttachmentOutcome> {
    const note = this.noteRepository.findById(input.noteId)
    if (!note || note.deletedAt || note.isArchived) {
      throw new AttachmentStorageError('Dosyanın ekleneceği not bulunamadı.')
    }

    let sourcePath: string | null
    try {
      sourcePath = await this.dependencies.chooseFile(input.accept ?? 'all')
    } catch (error) {
      throw new AttachmentStorageError('Dosya seçici açılamadı. Lütfen tekrar deneyin.', error)
    }
    if (!sourcePath) return { status: 'cancelled' }

    return {
      status: 'stored',
      attachment: await this.store(input.noteId, sourcePath, input.accept ?? 'all'),
    }
  }

  private async store(
    noteId: string,
    sourcePath: string,
    accept: AttachmentAccept,
  ): Promise<Attachment> {
    let sourceMetadata
    try {
      sourceMetadata = await stat(sourcePath)
    } catch (error) {
      throw new AttachmentStorageError('Seçilen dosya okunamadı.', error)
    }
    if (!sourceMetadata.isFile()) {
      throw new AttachmentStorageError('Yalnızca normal dosyalar eklenebilir.')
    }
    if (sourceMetadata.size > this.maxAttachmentBytes) {
      const limitLabel =
        this.maxAttachmentBytes >= 1024 * 1024
          ? `${Math.floor(this.maxAttachmentBytes / (1024 * 1024))} MB`
          : `${this.maxAttachmentBytes} bayt`
      throw new AttachmentStorageError(`Dosya ${limitLabel} boyut sınırını aşıyor.`)
    }

    const extension = extname(sourcePath).toLocaleLowerCase('en-US')
    let header: Buffer
    try {
      header = await readHeader(sourcePath, sourceMetadata.size)
    } catch (error) {
      throw new AttachmentStorageError('Seçilen dosya okunamadı.', error)
    }
    const mimeType = detectMimeType(extension, header)
    if (!mimeType) {
      throw new AttachmentStorageError(
        `Bu dosya türü desteklenmiyor. Desteklenen türler: ${SUPPORTED_TYPE_DESCRIPTION}.`,
      )
    }
    if (accept === 'image' && !mimeType.startsWith('image/')) {
      throw new AttachmentStorageError('Seçilen dosya bir görsel veya GIF değil.')
    }
    if (accept === 'video' && !mimeType.startsWith('video/')) {
      throw new AttachmentStorageError('Seçilen dosya desteklenen bir video değil.')
    }
    if (accept === 'file' && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))) {
      throw new AttachmentStorageError('Resim ve videolar kendi ekleme düğmeleriyle eklenmelidir.')
    }
    const id = this.createId()
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) {
      throw new AttachmentStorageError('Dosya için güvenli bir kimlik oluşturulamadı.')
    }
    const storedFileName = `${id}${extension}`
    const destination = controlledDestination(this.storageRoot, storedFileName)
    const record: AttachmentRecord = {
      id,
      noteId,
      blockId: null,
      originalFileName: sanitizeAttachmentFileName(basename(sourcePath)),
      storedFileName,
      relativePath: storedFileName,
      mimeType,
      fileSize: sourceMetadata.size,
      width: null,
      height: null,
      createdAt: this.now().toISOString(),
    }

    try {
      await mkdir(this.storageRoot, { recursive: true })
      await copyFile(sourcePath, destination, fileSystemConstants.COPYFILE_EXCL)
    } catch (error) {
      throw new AttachmentStorageError('Dosya güvenli uygulama alanına kopyalanamadı.', error)
    }

    try {
      this.repository.insert(record)
    } catch (error) {
      await unlink(destination).catch(() => undefined)
      throw new AttachmentStorageError('Dosya metadata bilgisi kaydedilemedi.', error)
    }

    return publicAttachment(record)
  }

  resolveStoredFile(attachmentId: string): { filePath: string; mimeType: string } | null {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(attachmentId)) return null
    const record = this.repository.findById(attachmentId)
    if (!record || record.relativePath !== record.storedFileName) return null

    try {
      return {
        filePath: controlledDestination(this.storageRoot, record.relativePath),
        mimeType: record.mimeType,
      }
    } catch {
      return null
    }
  }

  get(input: AttachmentIdInput): Attachment {
    const record = this.repository.findById(input.attachmentId)
    if (!record) throw new AttachmentStorageError('Dosya eki bulunamadı.')
    return publicAttachment(record)
  }

  async openExternal(input: AttachmentIdInput): Promise<{ opened: true }> {
    const content = this.resolveStoredFile(input.attachmentId)
    if (!content) throw new AttachmentStorageError('Dosya eki bulunamadı.')

    try {
      const metadata = await stat(content.filePath)
      if (!metadata.isFile()) throw new Error('Not a regular file.')
    } catch (error) {
      throw new AttachmentStorageError('Dosya artık güvenli saklama alanında bulunamıyor.', error)
    }

    if (!this.dependencies.openPath) {
      throw new AttachmentStorageError('Dış uygulamada açma işlemi kullanılamıyor.')
    }
    let openError: string
    try {
      openError = await this.dependencies.openPath(content.filePath)
    } catch (error) {
      throw new AttachmentStorageError('Dosya dış uygulamada açılamadı.', error)
    }
    if (openError) throw new AttachmentStorageError('Dosya dış uygulamada açılamadı.')

    return { opened: true }
  }

  async deleteOrphanedFiles(relativePaths: readonly string[]): Promise<number> {
    let deletedCount = 0
    for (const relativePath of new Set(relativePaths)) {
      try {
        const filePath = controlledDestination(this.storageRoot, relativePath)
        await unlink(filePath)
        deletedCount += 1
      } catch {
        // Metadata is already removed transactionally. A missing or locked orphan is safer to retain.
      }
    }
    return deletedCount
  }
}
