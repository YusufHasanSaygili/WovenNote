// @vitest-environment node

import type Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, openDatabase } from '../database/database'
import { NoteRepository } from '../repositories/note-repository'
import { NoteService } from './note-service'
import { NoteExportService, sanitizeExportFileName } from './note-export-service'

let database: Database.Database | undefined

afterEach(() => {
  closeDatabase(database)
  database = undefined
})

function repositoryWithNote(): NoteRepository {
  database = openDatabase(':memory:')
  const repository = new NoteRepository(database)
  new NoteService(repository, {
    createId: () => 'export-service-note',
    now: () => new Date('2026-07-28T12:00:00.000Z'),
  }).create({ title: 'Windows: planı?' })
  return repository
}

describe('NoteExportService', () => {
  it('uses a sanitized default name, appends the extension and writes UTF-8 content', async () => {
    const chooseDestination = vi.fn(async () => ({
      cancelled: false,
      filePath: 'C:\\Exports\\plan',
    }))
    const writeFile = vi.fn(async () => undefined)
    const service = new NoteExportService(repositoryWithNote(), {
      chooseDestination,
      writeFile,
      now: () => new Date('2026-07-28T13:00:00.000Z'),
    })

    await expect(
      service.exportNote({ noteId: 'export-service-note', format: 'markdown' }),
    ).resolves.toMatchObject({ status: 'saved', format: 'markdown', fileName: 'plan.md' })
    expect(chooseDestination).toHaveBeenCalledWith({
      defaultFileName: 'Windows- planı-.md',
      extensions: ['md'],
      formatName: 'Markdown',
    })
    expect(writeFile).toHaveBeenCalledWith(
      'C:\\Exports\\plan.md',
      expect.stringContaining('# Windows: planı?'),
    )
  })

  it('treats save-dialog cancellation as a normal outcome and writes nothing', async () => {
    const writeFile = vi.fn(async () => undefined)
    const service = new NoteExportService(repositoryWithNote(), {
      chooseDestination: async () => ({ cancelled: true }),
      writeFile,
    })

    await expect(
      service.exportNote({ noteId: 'export-service-note', format: 'txt' }),
    ).resolves.toEqual({ status: 'cancelled' })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('propagates invalid destination failures for the IPC boundary to handle', async () => {
    const service = new NoteExportService(repositoryWithNote(), {
      chooseDestination: async () => ({ cancelled: false, filePath: 'Z:\\missing\\note.json' }),
      writeFile: async () => {
        throw new Error('ENOENT')
      },
    })

    await expect(
      service.exportNote({ noteId: 'export-service-note', format: 'json' }),
    ).rejects.toThrow('ENOENT')
  })

  it('writes validated PDF bytes supplied by the PDF renderer', async () => {
    const pdf = Buffer.from(`%PDF-1.7\n${'x'.repeat(120)}\n%%EOF`)
    const writeFile = vi.fn(async () => undefined)
    const renderPdf = vi.fn(async () => pdf)
    const service = new NoteExportService(repositoryWithNote(), {
      chooseDestination: async () => ({ cancelled: false, filePath: 'C:\\Exports\\plan.pdf' }),
      renderPdf,
      writeFile,
    })

    await expect(
      service.exportNote({ noteId: 'export-service-note', format: 'pdf' }),
    ).resolves.toMatchObject({
      status: 'saved',
      format: 'pdf',
      fileName: 'plan.pdf',
      bytesWritten: pdf.length,
    })
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'export-service-note' }))
    expect(writeFile).toHaveBeenCalledWith('C:\\Exports\\plan.pdf', pdf)
  })

  it('avoids blank and reserved Windows file names', () => {
    expect(sanitizeExportFileName('...')).toBe('Adsız not')
    expect(sanitizeExportFileName('CON')).toBe('not-CON')
  })
})
