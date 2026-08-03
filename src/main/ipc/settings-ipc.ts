import type { IpcMain } from 'electron'

import { SETTINGS_CHANNELS } from '../../shared/ipc-channels'
import {
  DetailLayoutResultSchema,
  GetDetailLayoutInputSchema,
  SetDetailLayoutInputSchema,
} from '../../shared/schemas/detail-contracts'
import {
  AiConnectionTestResultSchema,
  AiSettingsResultSchema,
  GetAiSettingsInputSchema,
  SaveAiSettingsInputSchema,
  TestAiConnectionInputSchema,
} from '../../shared/schemas/ai-settings-contracts'
import type { AiSettingsService } from '../services/ai-settings-service'
import type { SettingsService } from '../services/settings-service'
import { createValidatedHandler } from './validated-handler'

export function registerSettingsIpcHandlers(
  ipcMain: IpcMain,
  settingsService: SettingsService,
  aiSettingsService: AiSettingsService,
): () => void {
  ipcMain.handle(
    SETTINGS_CHANNELS.getAiSettings,
    createValidatedHandler({
      inputSchema: GetAiSettingsInputSchema,
      resultSchema: AiSettingsResultSchema,
      operation: () => aiSettingsService.getSettings(),
      operationErrorMessage: () => 'AI ayarları okunamadı.',
    }),
  )
  ipcMain.handle(
    SETTINGS_CHANNELS.getDetailLayout,
    createValidatedHandler({
      inputSchema: GetDetailLayoutInputSchema,
      resultSchema: DetailLayoutResultSchema,
      operation: () => settingsService.getDetailLayout(),
    }),
  )
  ipcMain.handle(
    SETTINGS_CHANNELS.saveAiSettings,
    createValidatedHandler({
      inputSchema: SaveAiSettingsInputSchema,
      resultSchema: AiSettingsResultSchema,
      operation: (input) => aiSettingsService.saveSettings(input),
      operationErrorMessage: () => 'AI ayarları güvenli biçimde kaydedilemedi.',
      validationErrorMessage: 'Gönderilen AI ayarları geçersiz.',
    }),
  )
  ipcMain.handle(
    SETTINGS_CHANNELS.setDetailLayout,
    createValidatedHandler({
      inputSchema: SetDetailLayoutInputSchema,
      resultSchema: DetailLayoutResultSchema,
      operation: (input) => settingsService.setDetailLayout(input),
    }),
  )
  ipcMain.handle(
    SETTINGS_CHANNELS.testAiConnection,
    createValidatedHandler({
      inputSchema: TestAiConnectionInputSchema,
      resultSchema: AiConnectionTestResultSchema,
      operation: () => aiSettingsService.testConnection(),
      operationErrorMessage: () => 'AI bağlantı testi tamamlanamadı.',
    }),
  )

  return () => {
    ipcMain.removeHandler(SETTINGS_CHANNELS.getAiSettings)
    ipcMain.removeHandler(SETTINGS_CHANNELS.getDetailLayout)
    ipcMain.removeHandler(SETTINGS_CHANNELS.saveAiSettings)
    ipcMain.removeHandler(SETTINGS_CHANNELS.setDetailLayout)
    ipcMain.removeHandler(SETTINGS_CHANNELS.testAiConnection)
  }
}
