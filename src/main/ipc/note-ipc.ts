import type { IpcMain } from 'electron'

import { NOTE_CHANNELS } from '../../shared/ipc-channels'
import {
  CreateNoteInputSchema,
  CreateNoteResultSchema,
  ListNotesInputSchema,
  ListNotesResultSchema,
  NoteIdInputSchema,
  NoteMutationResultSchema,
  PermanentlyDeleteNoteInputSchema,
  PermanentlyDeleteNoteResultSchema,
  RenameNoteInputSchema,
  SaveNoteContentInputSchema,
  SearchNotesInputSchema,
  SearchNotesResultSchema,
  SoftDeleteNoteResultSchema,
  UpdateNoteLayoutsInputSchema,
  UpdateNoteLayoutsResultSchema,
} from '../../shared/schemas/note-contracts'
import {
  ListNoteVersionsInputSchema,
  ListNoteVersionsResultSchema,
  RestoreNoteVersionInputSchema,
  RestoreNoteVersionResultSchema,
} from '../../shared/schemas/note-version-contracts'
import type { NoteService } from '../services/note-service'
import { createValidatedHandler } from './validated-handler'

export function registerNoteIpcHandlers(ipcMain: IpcMain, noteService: NoteService): () => void {
  ipcMain.handle(
    NOTE_CHANNELS.archive,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.archive(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.create,
    createValidatedHandler({
      inputSchema: CreateNoteInputSchema,
      resultSchema: CreateNoteResultSchema,
      operation: (input) => noteService.create(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.open,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.open(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.rename,
    createValidatedHandler({
      inputSchema: RenameNoteInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.rename(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.duplicate,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.duplicate(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.saveContent,
    createValidatedHandler({
      inputSchema: SaveNoteContentInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.saveContent(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.softDelete,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: SoftDeleteNoteResultSchema,
      operation: (input) => noteService.softDelete(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.restore,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.restore(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.unarchive,
    createValidatedHandler({
      inputSchema: NoteIdInputSchema,
      resultSchema: NoteMutationResultSchema,
      operation: (input) => noteService.unarchive(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.permanentlyDelete,
    createValidatedHandler({
      inputSchema: PermanentlyDeleteNoteInputSchema,
      resultSchema: PermanentlyDeleteNoteResultSchema,
      operation: (input) => noteService.permanentlyDelete(input),
      validationErrorMessage: 'Kalıcı silme onayı geçersiz.',
      operationErrorMessage: () => 'Not kalıcı olarak silinemedi. Lütfen tekrar deneyin.',
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.updateLayouts,
    createValidatedHandler({
      inputSchema: UpdateNoteLayoutsInputSchema,
      resultSchema: UpdateNoteLayoutsResultSchema,
      operation: (input) => noteService.updateLayouts(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.list,
    createValidatedHandler({
      inputSchema: ListNotesInputSchema,
      resultSchema: ListNotesResultSchema,
      operation: () => noteService.list(),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.listArchived,
    createValidatedHandler({
      inputSchema: ListNotesInputSchema,
      resultSchema: ListNotesResultSchema,
      operation: () => noteService.listArchived(),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.listTrashed,
    createValidatedHandler({
      inputSchema: ListNotesInputSchema,
      resultSchema: ListNotesResultSchema,
      operation: () => noteService.listTrashed(),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.listVersions,
    createValidatedHandler({
      inputSchema: ListNoteVersionsInputSchema,
      resultSchema: ListNoteVersionsResultSchema,
      operation: (input) => noteService.listVersions(input),
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.restoreVersion,
    createValidatedHandler({
      inputSchema: RestoreNoteVersionInputSchema,
      resultSchema: RestoreNoteVersionResultSchema,
      operation: (input) => noteService.restoreVersion(input),
      validationErrorMessage: 'Sürüm geri yükleme onayı geçersiz.',
      operationErrorMessage: () => 'Not sürümü geri yüklenemedi. Lütfen tekrar deneyin.',
    }),
  )

  ipcMain.handle(
    NOTE_CHANNELS.search,
    createValidatedHandler({
      inputSchema: SearchNotesInputSchema,
      resultSchema: SearchNotesResultSchema,
      operation: (input) => noteService.search(input),
      validationErrorMessage: 'Arama sorgusu geçersiz.',
      operationErrorMessage: () => 'Notlarda arama yapılamadı. Lütfen tekrar deneyin.',
    }),
  )

  return () => {
    for (const channel of Object.values(NOTE_CHANNELS)) ipcMain.removeHandler(channel)
  }
}
