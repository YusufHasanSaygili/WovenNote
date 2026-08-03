import { constants as fileSystemConstants } from 'node:fs'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

import Database from 'better-sqlite3'

const CURRENT_DATABASE_FILE_NAME = 'wovennote.sqlite3'
const LEGACY_DATABASE_FILE_NAME = ['note', 'gpt.sqlite3'].join('')
const LEGACY_PRODUCT_NAME = ['Note', 'GPT'].join('')

export interface BrandDataMigrationResult {
  readonly migrated: boolean
  readonly sourceDirectory: string | null
  readonly targetDirectory: string
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function copyDirectoryWithoutOverwrite(
  sourceDirectory: string,
  targetDirectory: string,
): Promise<void> {
  let entries
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  await mkdir(targetDirectory, { recursive: true })
  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name)
    const targetPath = join(targetDirectory, entry.name)
    if (entry.isDirectory()) {
      await copyDirectoryWithoutOverwrite(sourcePath, targetPath)
      continue
    }
    if (!entry.isFile()) {
      throw new Error('Legacy profile contains an unsupported filesystem entry.')
    }
    try {
      await copyFile(sourcePath, targetPath, fileSystemConstants.COPYFILE_EXCL)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
}

export async function migrateLegacyUserData(
  appDataDirectory: string,
  targetDirectory: string,
): Promise<BrandDataMigrationResult> {
  const targetDatabasePath = join(targetDirectory, CURRENT_DATABASE_FILE_NAME)
  if (await isFile(targetDatabasePath)) {
    return { migrated: false, sourceDirectory: null, targetDirectory }
  }

  const sourceDirectory = join(appDataDirectory, LEGACY_PRODUCT_NAME)
  const sourceDatabasePath = join(sourceDirectory, LEGACY_DATABASE_FILE_NAME)
  if (!(await isFile(sourceDatabasePath))) {
    return { migrated: false, sourceDirectory: null, targetDirectory }
  }

  await mkdir(targetDirectory, { recursive: true })
  const stagedDatabasePath = join(targetDirectory, `${CURRENT_DATABASE_FILE_NAME}.migrating`)
  await rm(stagedDatabasePath, { force: true })

  const sourceDatabase = new Database(sourceDatabasePath, {
    fileMustExist: true,
    readonly: true,
  })
  try {
    await sourceDatabase.backup(stagedDatabasePath)
  } finally {
    sourceDatabase.close()
  }

  try {
    await copyDirectoryWithoutOverwrite(
      join(sourceDirectory, 'attachments'),
      join(targetDirectory, 'attachments'),
    )
    await copyDirectoryWithoutOverwrite(
      join(sourceDirectory, 'secrets'),
      join(targetDirectory, 'secrets'),
    )
    await rename(stagedDatabasePath, targetDatabasePath)
  } catch (error) {
    await rm(stagedDatabasePath, { force: true }).catch(() => undefined)
    throw error
  }

  return { migrated: true, sourceDirectory, targetDirectory }
}
