// @vitest-environment node

import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { BackupManifestSchema, type BackupManifest } from '../../shared/schemas/backup-contracts'
import { decodeBackupArchive, encodeBackupArchive, sha256Hex } from './backup-archive'

function manifestFor(media: Uint8Array = new Uint8Array()): BackupManifest {
  return BackupManifestSchema.parse({
    format: 'wovennote-backup',
    backupVersion: 1,
    schemaVersion: 7,
    createdAt: '2026-07-28T20:00:00.000Z',
    data: {
      notes: [
        {
          id: 'backup-note-001',
          title: 'Yedek notu',
          preview: 'İçerik',
          searchText: 'İçerik',
          contentJson: JSON.stringify({
            documentVersion: 1,
            editor: 'tiptap',
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'İçerik' }] }],
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
          createdAt: '2026-07-28T19:00:00.000Z',
          updatedAt: '2026-07-28T19:00:00.000Z',
        },
      ],
      tags: [],
      noteTags: [],
      attachments:
        media.length === 0
          ? []
          : [
              {
                id: 'media-001',
                noteId: 'backup-note-001',
                blockId: null,
                originalFileName: 'image.png',
                storedFileName: 'media-001.png',
                relativePath: 'media-001.png',
                mimeType: 'image/png',
                fileSize: media.byteLength,
                width: null,
                height: null,
                createdAt: '2026-07-28T19:00:00.000Z',
                archivePath: 'media/media-001.png',
                sha256: sha256Hex(media),
              },
            ],
      chatSessions: [],
      chatMessages: [],
      noteVersions: [],
      settings: [],
    },
  })
}

describe('backup archive', () => {
  it('round-trips a strict versioned manifest and checksummed media', () => {
    const media = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
    const manifest = manifestFor(media)
    const archive = encodeBackupArchive(manifest, new Map([['media/media-001.png', media]]))
    const decoded = decodeBackupArchive(archive)

    expect(decoded.manifest).toEqual(manifest)
    expect(decoded.media.get('media/media-001.png')).toEqual(media)
  })

  it('accepts backups created before the WovenNote rename', () => {
    const legacyFormat = ['note', 'gpt-backup'].join('')
    const legacyManifest = BackupManifestSchema.parse({
      ...manifestFor(),
      format: legacyFormat,
      schemaVersion: 6,
    })

    expect(legacyManifest).toMatchObject({ format: legacyFormat, schemaVersion: 6 })
  })

  it('rejects media changed after the manifest checksum was created', () => {
    const media = Uint8Array.from([1, 2, 3, 4])
    const archive = encodeBackupArchive(
      manifestFor(media),
      new Map([['media/media-001.png', media]]),
    )
    const entries = unzipSync(archive)
    entries['media/media-001.png'] = Uint8Array.from([4, 3, 2, 1])

    expect(() => decodeBackupArchive(zipSync(entries))).toThrow('checksum')
  })

  it('rejects path traversal before extracting archive entries', () => {
    const unsafe = zipSync({ '../outside.txt': strToU8('no') })
    expect(() => decodeBackupArchive(unsafe)).toThrow('güvenli olmayan bir arşiv yolu')
  })

  it('rejects over-posted or future manifest structures', () => {
    const manifest = manifestFor()
    expect(() =>
      BackupManifestSchema.parse({ ...manifest, backupVersion: 2, secret: 'sk-never' }),
    ).toThrow()
  })
})
