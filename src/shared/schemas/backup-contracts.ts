import { z } from 'zod'

import { EditorDocumentEnvelopeSchema } from './editor-document'
import { IpcErrorSchema, NoteSchema } from './note-contracts'
import { TagSchema } from './tag-schema'

const LEGACY_BACKUP_FORMAT = ['note', 'gpt-backup'].join('')

const BackupFormatSchema = z
  .string()
  .refine(
    (value) => value === 'wovennote-backup' || value === LEGACY_BACKUP_FORMAT,
    'Yedek formatı desteklenmiyor.',
  )

const StoredEditorJsonSchema = z
  .string()
  .max(50 * 1024 * 1024)
  .superRefine((value, context) => {
    try {
      if (!EditorDocumentEnvelopeSchema.safeParse(JSON.parse(value)).success) {
        context.addIssue({ code: 'custom', message: 'Editör belgesi geçersiz.' })
      }
    } catch {
      context.addIssue({ code: 'custom', message: 'Editör belgesi geçersiz JSON içeriyor.' })
    }
  })

export const BackupNoteSchema = NoteSchema.omit({ tags: true }).extend({
  contentJson: StoredEditorJsonSchema,
})

export const BackupNoteTagSchema = z
  .object({ noteId: z.string().min(1).max(100), tagId: z.string().min(1).max(100) })
  .strict()

export const BackupAttachmentSchema = z
  .object({
    id: z.string().min(1).max(100),
    noteId: z.string().min(1).max(100),
    blockId: z.string().max(100).nullable(),
    originalFileName: z.string().min(1).max(200),
    storedFileName: z.string().regex(/^[a-zA-Z0-9-]{1,100}\.[a-zA-Z0-9]{1,10}$/),
    relativePath: z.string().regex(/^[a-zA-Z0-9-]{1,100}\.[a-zA-Z0-9]{1,10}$/),
    mimeType: z.string().min(1).max(200),
    fileSize: z
      .number()
      .int()
      .nonnegative()
      .max(100 * 1024 * 1024),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    createdAt: z.string().min(1),
    archivePath: z.string().regex(/^media\/[a-zA-Z0-9-]{1,100}\.[a-zA-Z0-9]{1,10}$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine((attachment) => attachment.relativePath === attachment.storedFileName, {
    message: 'Attachment yolu saklama adıyla eşleşmelidir.',
  })
  .refine((attachment) => attachment.archivePath === `media/${attachment.storedFileName}`, {
    message: 'Attachment arşiv yolu saklama adıyla eşleşmelidir.',
  })

export const BackupChatSessionSchema = z
  .object({
    id: z.string().min(1).max(100),
    noteId: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict()

export const BackupChatMessageSchema = z
  .object({
    id: z.string().min(1).max(100),
    sessionId: z.string().min(1).max(100),
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2_000_000),
    status: z.enum(['pending', 'complete', 'error', 'cancelled']),
    createdAt: z.string().min(1),
  })
  .strict()

export const BackupNoteVersionSchema = z
  .object({
    id: z.string().min(1).max(100),
    noteId: z.string().min(1).max(100),
    contentJson: StoredEditorJsonSchema,
    reason: z.enum(['autosave', 'restore']),
    createdAt: z.string().min(1),
  })
  .strict()

export const BackupSettingSchema = z
  .object({
    key: z.enum(['ai-preferences-v1', 'note-detail-layout']),
    valueJson: z.string().max(100_000),
    updatedAt: z.string().min(1),
  })
  .strict()
  .superRefine((setting, context) => {
    try {
      JSON.parse(setting.valueJson)
    } catch {
      context.addIssue({ code: 'custom', message: 'Ayar değeri geçerli JSON olmalıdır.' })
    }
  })

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

export const BackupDataSchema = z
  .object({
    notes: z.array(BackupNoteSchema).max(100_000),
    tags: z.array(TagSchema).max(100_000),
    noteTags: z.array(BackupNoteTagSchema).max(2_000_000),
    attachments: z.array(BackupAttachmentSchema).max(10_000),
    chatSessions: z.array(BackupChatSessionSchema).max(500_000),
    chatMessages: z.array(BackupChatMessageSchema).max(2_000_000),
    noteVersions: z.array(BackupNoteVersionSchema).max(2_000_000),
    settings: z.array(BackupSettingSchema).max(20),
  })
  .strict()
  .superRefine((data, context) => {
    const idGroups: ReadonlyArray<readonly [string, readonly string[]]> = [
      ['not', data.notes.map((row) => row.id)],
      ['etiket', data.tags.map((row) => row.id)],
      ['attachment', data.attachments.map((row) => row.id)],
      ['sohbet oturumu', data.chatSessions.map((row) => row.id)],
      ['sohbet mesajı', data.chatMessages.map((row) => row.id)],
      ['not sürümü', data.noteVersions.map((row) => row.id)],
      ['ayar', data.settings.map((row) => row.key)],
    ]
    for (const [label, ids] of idGroups) {
      if (!uniqueValues(ids)) {
        context.addIssue({ code: 'custom', message: `Yedekte yinelenen ${label} kimliği var.` })
      }
    }
    if (!uniqueValues(data.attachments.map((row) => row.archivePath))) {
      context.addIssue({ code: 'custom', message: 'Yedekte yinelenen medya yolu var.' })
    }
    if (!uniqueValues(data.noteTags.map((row) => `${row.noteId}\u0000${row.tagId}`))) {
      context.addIssue({ code: 'custom', message: 'Yedekte yinelenen not-etiket ilişkisi var.' })
    }

    const noteIds = new Set(data.notes.map((row) => row.id))
    const tagIds = new Set(data.tags.map((row) => row.id))
    const sessionIds = new Set(data.chatSessions.map((row) => row.id))
    const referencesAreValid =
      data.noteTags.every((row) => noteIds.has(row.noteId) && tagIds.has(row.tagId)) &&
      data.attachments.every((row) => noteIds.has(row.noteId)) &&
      data.chatSessions.every((row) => noteIds.has(row.noteId)) &&
      data.chatMessages.every((row) => sessionIds.has(row.sessionId)) &&
      data.noteVersions.every((row) => noteIds.has(row.noteId))
    if (!referencesAreValid) {
      context.addIssue({ code: 'custom', message: 'Yedekte bozuk kayıt referansı var.' })
    }
  })

export const BackupManifestSchema = z
  .object({
    format: BackupFormatSchema,
    backupVersion: z.literal(1),
    schemaVersion: z.union([z.literal(6), z.literal(7)]),
    createdAt: z.string().datetime(),
    data: BackupDataSchema,
  })
  .strict()

export const BackupConflictStrategySchema = z.enum(['keep-existing', 'replace', 'keep-both'])
export const EmptyBackupInputSchema = z.object({}).strict()
export const RestoreBackupInputSchema = z
  .object({
    importToken: z.string().uuid(),
    conflictStrategy: BackupConflictStrategySchema,
  })
  .strict()

export const BackupSummarySchema = z
  .object({
    createdAt: z.string().datetime(),
    notes: z.number().int().nonnegative(),
    attachments: z.number().int().nonnegative(),
    chatMessages: z.number().int().nonnegative(),
    noteConflicts: z.number().int().nonnegative(),
  })
  .strict()

export const CreateBackupOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }).strict(),
  z
    .object({
      status: z.literal('saved'),
      fileName: z.string().min(1).max(255),
      bytesWritten: z.number().int().nonnegative(),
      notes: z.number().int().nonnegative(),
      attachments: z.number().int().nonnegative(),
    })
    .strict(),
])

export const InspectBackupOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }).strict(),
  z
    .object({
      status: z.literal('ready'),
      importToken: z.string().uuid(),
      summary: BackupSummarySchema,
    })
    .strict(),
])

export const RestoreBackupOutcomeSchema = z
  .object({
    status: z.literal('restored'),
    notesImported: z.number().int().nonnegative(),
    notesSkipped: z.number().int().nonnegative(),
    attachmentsImported: z.number().int().nonnegative(),
  })
  .strict()

export const CreateBackupResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: CreateBackupOutcomeSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])
export const InspectBackupResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: InspectBackupOutcomeSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])
export const RestoreBackupResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: RestoreBackupOutcomeSchema }).strict(),
  z.object({ ok: z.literal(false), error: IpcErrorSchema }).strict(),
])

export type BackupNote = z.infer<typeof BackupNoteSchema>
export type BackupAttachment = z.infer<typeof BackupAttachmentSchema>
export type BackupManifest = z.infer<typeof BackupManifestSchema>
export type BackupData = z.infer<typeof BackupDataSchema>
export type BackupConflictStrategy = z.infer<typeof BackupConflictStrategySchema>
export type RestoreBackupInput = z.infer<typeof RestoreBackupInputSchema>
export type CreateBackupOutcome = z.infer<typeof CreateBackupOutcomeSchema>
export type InspectBackupOutcome = z.infer<typeof InspectBackupOutcomeSchema>
export type RestoreBackupOutcome = z.infer<typeof RestoreBackupOutcomeSchema>
export type CreateBackupResult = z.infer<typeof CreateBackupResultSchema>
export type InspectBackupResult = z.infer<typeof InspectBackupResultSchema>
export type RestoreBackupResult = z.infer<typeof RestoreBackupResultSchema>
