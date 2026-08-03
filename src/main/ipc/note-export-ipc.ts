import type { IpcMain } from 'electron'

import { EXPORT_CHANNELS } from '../../shared/ipc-channels'
import {
  ExportNoteInputSchema,
  ExportNoteResultSchema,
  type ExportNoteInput,
  type ExportNoteOutcome,
} from '../../shared/schemas/export-contracts'
import { createValidatedHandler } from './validated-handler'

interface NoteExporter {
  exportNote(input: ExportNoteInput): Promise<ExportNoteOutcome>
}

export function registerNoteExportIpcHandlers(
  ipcMain: IpcMain,
  exporter: NoteExporter,
): () => void {
  ipcMain.handle(
    EXPORT_CHANNELS.exportNote,
    createValidatedHandler({
      inputSchema: ExportNoteInputSchema,
      resultSchema: ExportNoteResultSchema,
      operation: (input) => exporter.exportNote(input),
      validationErrorMessage: 'Dışa aktarma isteği geçersiz.',
      operationErrorMessage: () => 'Not dışa aktarılamadı. Hedef klasörü ve izinleri kontrol edin.',
    }),
  )

  return () => ipcMain.removeHandler(EXPORT_CHANNELS.exportNote)
}
