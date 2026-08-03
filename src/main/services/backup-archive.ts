import { createHash, timingSafeEqual } from 'node:crypto'

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

import { BackupManifestSchema, type BackupManifest } from '../../shared/schemas/backup-contracts'

const MANIFEST_PATH = 'manifest.json'
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024
const MAX_MEDIA_BYTES = 100 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 10_001
const MEDIA_PATH_PATTERN = /^media\/[a-zA-Z0-9-]{1,100}\.[a-zA-Z0-9]{1,10}$/

export class BackupArchiveError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'BackupArchiveError'
  }
}

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function equalHash(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function validateMedia(
  manifest: BackupManifest,
  entries: Readonly<Record<string, Uint8Array>>,
): Map<string, Uint8Array> {
  const expectedPaths = new Set(manifest.data.attachments.map((row) => row.archivePath))
  const actualPaths = Object.keys(entries).filter((path) => path !== MANIFEST_PATH)
  if (
    actualPaths.length !== expectedPaths.size ||
    actualPaths.some((path) => !expectedPaths.has(path))
  ) {
    throw new BackupArchiveError('Yedek medya listesi manifest ile eşleşmiyor.')
  }

  const media = new Map<string, Uint8Array>()
  for (const attachment of manifest.data.attachments) {
    const data = entries[attachment.archivePath]
    if (!data || data.byteLength !== attachment.fileSize) {
      throw new BackupArchiveError('Yedekteki medya boyutu metadata ile eşleşmiyor.')
    }
    if (!equalHash(sha256Hex(data), attachment.sha256)) {
      throw new BackupArchiveError('Yedekteki medya checksum doğrulamasından geçemedi.')
    }
    media.set(attachment.archivePath, data)
  }
  return media
}

export function encodeBackupArchive(
  manifestInput: BackupManifest,
  media: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
  const manifest = BackupManifestSchema.parse(manifestInput)
  const syntheticEntries: Record<string, Uint8Array> = {
    [MANIFEST_PATH]: strToU8(JSON.stringify(manifest)),
  }
  for (const [path, data] of media) syntheticEntries[path] = data
  validateMedia(manifest, syntheticEntries)

  const entries: Zippable = {
    [MANIFEST_PATH]: [syntheticEntries[MANIFEST_PATH]!, { level: 6 }],
  }
  for (const [path, data] of media) entries[path] = [data, { level: 0 }]
  return zipSync(entries)
}

export function decodeBackupArchive(archive: Uint8Array): {
  readonly manifest: BackupManifest
  readonly media: ReadonlyMap<string, Uint8Array>
} {
  let entryCount = 0
  let uncompressedBytes = 0
  const seenPaths = new Set<string>()
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(archive, {
      filter: (file) => {
        entryCount += 1
        if (entryCount > MAX_ARCHIVE_ENTRIES) {
          throw new BackupArchiveError('Yedek çok fazla dosya içeriyor.')
        }
        if (seenPaths.has(file.name)) {
          throw new BackupArchiveError('Yedekte yinelenen arşiv yolu var.')
        }
        seenPaths.add(file.name)
        if (file.name !== MANIFEST_PATH && !MEDIA_PATH_PATTERN.test(file.name)) {
          throw new BackupArchiveError('Yedek güvenli olmayan bir arşiv yolu içeriyor.')
        }
        const entryLimit = file.name === MANIFEST_PATH ? MAX_MANIFEST_BYTES : MAX_MEDIA_BYTES
        if (file.originalSize > entryLimit) {
          throw new BackupArchiveError('Yedekte izin verilen boyutu aşan bir giriş var.')
        }
        uncompressedBytes += file.originalSize
        if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
          throw new BackupArchiveError('Yedeğin açılmış boyutu güvenli sınırı aşıyor.')
        }
        return true
      },
    })
  } catch (error) {
    if (error instanceof BackupArchiveError) throw error
    throw new BackupArchiveError('Yedek ZIP paketi açılamadı.', error)
  }

  const manifestBytes = entries[MANIFEST_PATH]
  if (!manifestBytes) throw new BackupArchiveError('Yedek manifest dosyası içermiyor.')

  let manifest: BackupManifest
  try {
    manifest = BackupManifestSchema.parse(JSON.parse(strFromU8(manifestBytes)))
  } catch (error) {
    throw new BackupArchiveError('Yedek manifest doğrulamasından geçemedi.', error)
  }
  return { manifest, media: validateMedia(manifest, entries) }
}
