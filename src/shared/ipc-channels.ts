export const AI_CHANNELS = Object.freeze({
  appendResponseToNote: 'ai:append-response-to-note',
  cancelInlineAction: 'ai:cancel-inline-action',
  cancelRequest: 'ai:cancel-request',
  copyResponse: 'ai:copy-response',
  createNoteFromResponse: 'ai:create-note-from-response',
  getThread: 'ai:get-thread',
  runInlineAction: 'ai:run-inline-action',
  sendMessage: 'ai:send-message',
})

export const NOTE_CHANNELS = Object.freeze({
  archive: 'notes:archive',
  create: 'notes:create',
  duplicate: 'notes:duplicate',
  list: 'notes:list',
  listArchived: 'notes:list-archived',
  listTrashed: 'notes:list-trashed',
  listVersions: 'notes:list-versions',
  open: 'notes:open',
  permanentlyDelete: 'notes:permanently-delete',
  rename: 'notes:rename',
  restore: 'notes:restore',
  restoreVersion: 'notes:restore-version',
  search: 'notes:search',
  saveContent: 'notes:save-content',
  softDelete: 'notes:soft-delete',
  unarchive: 'notes:unarchive',
  updateLayouts: 'notes:update-layouts',
})

export const SETTINGS_CHANNELS = Object.freeze({
  getAiSettings: 'settings:get-ai-settings',
  getDetailLayout: 'settings:get-detail-layout',
  saveAiSettings: 'settings:save-ai-settings',
  setDetailLayout: 'settings:set-detail-layout',
  testAiConnection: 'settings:test-ai-connection',
})

export const ATTACHMENT_CHANNELS = Object.freeze({
  get: 'attachments:get',
  openExternal: 'attachments:open-external',
  pickAndStore: 'attachments:pick-and-store',
})

export const EXPORT_CHANNELS = Object.freeze({
  createBackup: 'backups:create',
  exportNote: 'exports:note',
  inspectBackup: 'backups:inspect',
  restoreBackup: 'backups:restore',
})

export const ORGANIZATION_CHANNELS = Object.freeze({
  createTag: 'organization:create-tag',
  listTags: 'organization:list-tags',
  setFavorite: 'organization:set-favorite',
  setNoteTags: 'organization:set-note-tags',
  setPinned: 'organization:set-pinned',
})

export const ALLOWED_IPC_CHANNELS = Object.freeze([
  ...Object.values(AI_CHANNELS),
  ...Object.values(NOTE_CHANNELS),
  ...Object.values(SETTINGS_CHANNELS),
  ...Object.values(ATTACHMENT_CHANNELS),
  ...Object.values(EXPORT_CHANNELS),
  ...Object.values(ORGANIZATION_CHANNELS),
])
