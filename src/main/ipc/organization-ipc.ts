import type { IpcMain } from 'electron'

import { ORGANIZATION_CHANNELS } from '../../shared/ipc-channels'
import {
  CreateTagInputSchema,
  ListTagsInputSchema,
  ListTagsResultSchema,
  OrganizationNoteResultSchema,
  SetNoteFlagInputSchema,
  SetNoteTagsInputSchema,
  TagMutationResultSchema,
} from '../../shared/schemas/organization-contracts'
import { OrganizationError, type OrganizationService } from '../services/organization-service'
import { createValidatedHandler } from './validated-handler'

function organizationError(error: unknown): string {
  return error instanceof OrganizationError
    ? error.message
    : 'Not organizasyonu işlemi tamamlanamadı. Lütfen tekrar deneyin.'
}

export function registerOrganizationIpcHandlers(
  ipcMain: IpcMain,
  service: OrganizationService,
): () => void {
  ipcMain.handle(
    ORGANIZATION_CHANNELS.listTags,
    createValidatedHandler({
      inputSchema: ListTagsInputSchema,
      resultSchema: ListTagsResultSchema,
      operation: () => service.listTags(),
      operationErrorMessage: organizationError,
    }),
  )
  ipcMain.handle(
    ORGANIZATION_CHANNELS.createTag,
    createValidatedHandler({
      inputSchema: CreateTagInputSchema,
      resultSchema: TagMutationResultSchema,
      operation: (input) => service.createTag(input),
      operationErrorMessage: organizationError,
      validationErrorMessage: 'Etiket adı veya rengi geçersiz.',
    }),
  )
  ipcMain.handle(
    ORGANIZATION_CHANNELS.setNoteTags,
    createValidatedHandler({
      inputSchema: SetNoteTagsInputSchema,
      resultSchema: OrganizationNoteResultSchema,
      operation: (input) => service.setNoteTags(input),
      operationErrorMessage: organizationError,
    }),
  )
  ipcMain.handle(
    ORGANIZATION_CHANNELS.setPinned,
    createValidatedHandler({
      inputSchema: SetNoteFlagInputSchema,
      resultSchema: OrganizationNoteResultSchema,
      operation: (input) => service.setPinned(input),
      operationErrorMessage: organizationError,
    }),
  )
  ipcMain.handle(
    ORGANIZATION_CHANNELS.setFavorite,
    createValidatedHandler({
      inputSchema: SetNoteFlagInputSchema,
      resultSchema: OrganizationNoteResultSchema,
      operation: (input) => service.setFavorite(input),
      operationErrorMessage: organizationError,
    }),
  )

  return () => {
    for (const channel of Object.values(ORGANIZATION_CHANNELS)) ipcMain.removeHandler(channel)
  }
}
