import { contextBridge, ipcRenderer, webFrame } from 'electron'

import type { WovenNoteApi } from '../shared/preload-api'
import { handleControlWheelZoom } from '../shared/window-zoom'
import {
  AI_CHANNELS,
  ATTACHMENT_CHANNELS,
  EXPORT_CHANNELS,
  NOTE_CHANNELS,
  ORGANIZATION_CHANNELS,
  SETTINGS_CHANNELS,
} from '../shared/ipc-channels'
import type { ExportNoteInput } from '../shared/schemas/export-contracts'
import type { RestoreBackupInput } from '../shared/schemas/backup-contracts'
import type {
  AiResponseActionInput,
  CancelAiRequestInput,
  GetChatThreadInput,
  SendChatMessageInput,
} from '../shared/schemas/ai-chat-contracts'
import type { AttachmentIdInput, PickAttachmentInput } from '../shared/schemas/attachment-contracts'
import type {
  CancelInlineAiActionInput,
  RunInlineAiActionInput,
} from '../shared/schemas/inline-ai-contracts'
import type { SetDetailLayoutInput } from '../shared/schemas/detail-contracts'
import type { SaveAiSettingsInput } from '../shared/schemas/ai-settings-contracts'
import type {
  CreateNoteInput,
  NoteIdInput,
  PermanentlyDeleteNoteInput,
  RenameNoteInput,
  SaveNoteContentInput,
  SearchNotesInput,
  UpdateNoteLayoutsInput,
} from '../shared/schemas/note-contracts'
import type {
  CreateTagInput,
  SetNoteFlagInput,
  SetNoteTagsInput,
} from '../shared/schemas/organization-contracts'
import type {
  ListNoteVersionsInput,
  RestoreNoteVersionInput,
} from '../shared/schemas/note-version-contracts'

const wovenNoteApi: WovenNoteApi = Object.freeze({
  ai: Object.freeze({
    appendResponseToNote: (input: AiResponseActionInput) =>
      ipcRenderer.invoke(AI_CHANNELS.appendResponseToNote, input),
    cancelInlineAction: (input: CancelInlineAiActionInput) =>
      ipcRenderer.invoke(AI_CHANNELS.cancelInlineAction, input),
    cancelRequest: (input: CancelAiRequestInput) =>
      ipcRenderer.invoke(AI_CHANNELS.cancelRequest, input),
    copyResponse: (input: AiResponseActionInput) =>
      ipcRenderer.invoke(AI_CHANNELS.copyResponse, input),
    createNoteFromResponse: (input: AiResponseActionInput) =>
      ipcRenderer.invoke(AI_CHANNELS.createNoteFromResponse, input),
    getThread: (input: GetChatThreadInput) => ipcRenderer.invoke(AI_CHANNELS.getThread, input),
    runInlineAction: (input: RunInlineAiActionInput) =>
      ipcRenderer.invoke(AI_CHANNELS.runInlineAction, input),
    sendMessage: (input: SendChatMessageInput) =>
      ipcRenderer.invoke(AI_CHANNELS.sendMessage, input),
  }),
  attachments: Object.freeze({
    get: (input: AttachmentIdInput) => ipcRenderer.invoke(ATTACHMENT_CHANNELS.get, input),
    openExternal: (input: AttachmentIdInput) =>
      ipcRenderer.invoke(ATTACHMENT_CHANNELS.openExternal, input),
    pickAndStore: (input: PickAttachmentInput) =>
      ipcRenderer.invoke(ATTACHMENT_CHANNELS.pickAndStore, input),
  }),
  getRuntimeInfo: () =>
    Object.freeze({
      platform: process.platform,
    }),
  exports: Object.freeze({
    createBackup: () => ipcRenderer.invoke(EXPORT_CHANNELS.createBackup, {}),
    exportNote: (input: ExportNoteInput) => ipcRenderer.invoke(EXPORT_CHANNELS.exportNote, input),
    inspectBackup: () => ipcRenderer.invoke(EXPORT_CHANNELS.inspectBackup, {}),
    restoreBackup: (input: RestoreBackupInput) =>
      ipcRenderer.invoke(EXPORT_CHANNELS.restoreBackup, input),
  }),
  notes: Object.freeze({
    archive: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.archive, input),
    create: (input: CreateNoteInput) => ipcRenderer.invoke(NOTE_CHANNELS.create, input),
    duplicate: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.duplicate, input),
    list: () => ipcRenderer.invoke(NOTE_CHANNELS.list, {}),
    listArchived: () => ipcRenderer.invoke(NOTE_CHANNELS.listArchived, {}),
    listTrashed: () => ipcRenderer.invoke(NOTE_CHANNELS.listTrashed, {}),
    listVersions: (input: ListNoteVersionsInput) =>
      ipcRenderer.invoke(NOTE_CHANNELS.listVersions, input),
    open: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.open, input),
    permanentlyDelete: (input: PermanentlyDeleteNoteInput) =>
      ipcRenderer.invoke(NOTE_CHANNELS.permanentlyDelete, input),
    rename: (input: RenameNoteInput) => ipcRenderer.invoke(NOTE_CHANNELS.rename, input),
    restore: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.restore, input),
    restoreVersion: (input: RestoreNoteVersionInput) =>
      ipcRenderer.invoke(NOTE_CHANNELS.restoreVersion, input),
    saveContent: (input: SaveNoteContentInput) =>
      ipcRenderer.invoke(NOTE_CHANNELS.saveContent, input),
    search: (input: SearchNotesInput) => ipcRenderer.invoke(NOTE_CHANNELS.search, input),
    softDelete: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.softDelete, input),
    unarchive: (input: NoteIdInput) => ipcRenderer.invoke(NOTE_CHANNELS.unarchive, input),
    updateLayouts: (input: UpdateNoteLayoutsInput) =>
      ipcRenderer.invoke(NOTE_CHANNELS.updateLayouts, input),
  }),
  organization: Object.freeze({
    createTag: (input: CreateTagInput) =>
      ipcRenderer.invoke(ORGANIZATION_CHANNELS.createTag, input),
    listTags: () => ipcRenderer.invoke(ORGANIZATION_CHANNELS.listTags, {}),
    setFavorite: (input: SetNoteFlagInput) =>
      ipcRenderer.invoke(ORGANIZATION_CHANNELS.setFavorite, input),
    setNoteTags: (input: SetNoteTagsInput) =>
      ipcRenderer.invoke(ORGANIZATION_CHANNELS.setNoteTags, input),
    setPinned: (input: SetNoteFlagInput) =>
      ipcRenderer.invoke(ORGANIZATION_CHANNELS.setPinned, input),
  }),
  settings: Object.freeze({
    getAiSettings: () => ipcRenderer.invoke(SETTINGS_CHANNELS.getAiSettings, {}),
    getDetailLayout: () => ipcRenderer.invoke(SETTINGS_CHANNELS.getDetailLayout, {}),
    saveAiSettings: (input: SaveAiSettingsInput) =>
      ipcRenderer.invoke(SETTINGS_CHANNELS.saveAiSettings, input),
    setDetailLayout: (input: SetDetailLayoutInput) =>
      ipcRenderer.invoke(SETTINGS_CHANNELS.setDetailLayout, input),
    testAiConnection: () => ipcRenderer.invoke(SETTINGS_CHANNELS.testAiConnection, {}),
  }),
})

window.addEventListener(
  'wheel',
  (event) => {
    handleControlWheelZoom(event, webFrame)
  },
  { passive: false },
)

contextBridge.exposeInMainWorld('wovenNote', wovenNoteApi)
