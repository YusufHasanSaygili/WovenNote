import type {
  CreateNoteInput,
  CreateNoteResult,
  ListNotesResult,
  NoteIdInput,
  NoteMutationResult,
  PermanentlyDeleteNoteInput,
  PermanentlyDeleteNoteResult,
  RenameNoteInput,
  SaveNoteContentInput,
  SearchNotesInput,
  SearchNotesResult,
  SoftDeleteNoteResult,
  UpdateNoteLayoutsInput,
  UpdateNoteLayoutsResult,
} from './schemas/note-contracts'
import type { DetailLayoutResult, SetDetailLayoutInput } from './schemas/detail-contracts'
import type {
  AiConnectionTestResult,
  AiSettingsResult,
  SaveAiSettingsInput,
} from './schemas/ai-settings-contracts'
import type {
  AiResponseActionInput,
  AiResponseNoteResult,
  CancelAiRequestInput,
  CancelAiRequestResult,
  ChatThreadResult,
  CopyAiResponseResult,
  GetChatThreadInput,
  SendChatMessageInput,
  SendChatMessageResult,
} from './schemas/ai-chat-contracts'
import type {
  CancelInlineAiActionInput,
  CancelInlineAiActionResult,
  RunInlineAiActionInput,
  RunInlineAiActionResult,
} from './schemas/inline-ai-contracts'
import type {
  CreateTagInput,
  CreateTagResult,
  ListTagsResult,
  OrganizationNoteResult,
  SetNoteFlagInput,
  SetNoteTagsInput,
} from './schemas/organization-contracts'
import type {
  AttachmentIdInput,
  GetAttachmentResult,
  OpenAttachmentResult,
  PickAttachmentInput,
  PickAttachmentResult,
} from './schemas/attachment-contracts'
import type {
  ListNoteVersionsInput,
  ListNoteVersionsResult,
  RestoreNoteVersionInput,
  RestoreNoteVersionResult,
} from './schemas/note-version-contracts'
import type { ExportNoteInput, ExportNoteResult } from './schemas/export-contracts'
import type {
  CreateBackupResult,
  InspectBackupResult,
  RestoreBackupInput,
  RestoreBackupResult,
} from './schemas/backup-contracts'

export interface RuntimeInfo {
  readonly platform: string
}

export interface WovenNoteApi {
  readonly ai: Readonly<{
    appendResponseToNote: (input: AiResponseActionInput) => Promise<AiResponseNoteResult>
    cancelInlineAction: (input: CancelInlineAiActionInput) => Promise<CancelInlineAiActionResult>
    cancelRequest: (input: CancelAiRequestInput) => Promise<CancelAiRequestResult>
    copyResponse: (input: AiResponseActionInput) => Promise<CopyAiResponseResult>
    createNoteFromResponse: (input: AiResponseActionInput) => Promise<AiResponseNoteResult>
    getThread: (input: GetChatThreadInput) => Promise<ChatThreadResult>
    runInlineAction: (input: RunInlineAiActionInput) => Promise<RunInlineAiActionResult>
    sendMessage: (input: SendChatMessageInput) => Promise<SendChatMessageResult>
  }>
  readonly attachments: Readonly<{
    get: (input: AttachmentIdInput) => Promise<GetAttachmentResult>
    openExternal: (input: AttachmentIdInput) => Promise<OpenAttachmentResult>
    pickAndStore: (input: PickAttachmentInput) => Promise<PickAttachmentResult>
  }>
  readonly getRuntimeInfo: () => RuntimeInfo
  readonly exports: Readonly<{
    createBackup: () => Promise<CreateBackupResult>
    exportNote: (input: ExportNoteInput) => Promise<ExportNoteResult>
    inspectBackup: () => Promise<InspectBackupResult>
    restoreBackup: (input: RestoreBackupInput) => Promise<RestoreBackupResult>
  }>
  readonly notes: Readonly<{
    archive: (input: NoteIdInput) => Promise<NoteMutationResult>
    create: (input: CreateNoteInput) => Promise<CreateNoteResult>
    duplicate: (input: NoteIdInput) => Promise<NoteMutationResult>
    list: () => Promise<ListNotesResult>
    listArchived: () => Promise<ListNotesResult>
    listTrashed: () => Promise<ListNotesResult>
    listVersions: (input: ListNoteVersionsInput) => Promise<ListNoteVersionsResult>
    open: (input: NoteIdInput) => Promise<NoteMutationResult>
    permanentlyDelete: (input: PermanentlyDeleteNoteInput) => Promise<PermanentlyDeleteNoteResult>
    rename: (input: RenameNoteInput) => Promise<NoteMutationResult>
    restore: (input: NoteIdInput) => Promise<NoteMutationResult>
    restoreVersion: (input: RestoreNoteVersionInput) => Promise<RestoreNoteVersionResult>
    saveContent: (input: SaveNoteContentInput) => Promise<NoteMutationResult>
    search: (input: SearchNotesInput) => Promise<SearchNotesResult>
    softDelete: (input: NoteIdInput) => Promise<SoftDeleteNoteResult>
    unarchive: (input: NoteIdInput) => Promise<NoteMutationResult>
    updateLayouts: (input: UpdateNoteLayoutsInput) => Promise<UpdateNoteLayoutsResult>
  }>
  readonly organization: Readonly<{
    createTag: (input: CreateTagInput) => Promise<CreateTagResult>
    listTags: () => Promise<ListTagsResult>
    setFavorite: (input: SetNoteFlagInput) => Promise<OrganizationNoteResult>
    setNoteTags: (input: SetNoteTagsInput) => Promise<OrganizationNoteResult>
    setPinned: (input: SetNoteFlagInput) => Promise<OrganizationNoteResult>
  }>
  readonly settings: Readonly<{
    getAiSettings: () => Promise<AiSettingsResult>
    getDetailLayout: () => Promise<DetailLayoutResult>
    saveAiSettings: (input: SaveAiSettingsInput) => Promise<AiSettingsResult>
    setDetailLayout: (input: SetDetailLayoutInput) => Promise<DetailLayoutResult>
    testAiConnection: () => Promise<AiConnectionTestResult>
  }>
}
