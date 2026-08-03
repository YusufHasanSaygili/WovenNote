// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AI_CHANNELS,
  ALLOWED_IPC_CHANNELS,
  ATTACHMENT_CHANNELS,
  EXPORT_CHANNELS,
  NOTE_CHANNELS,
  ORGANIZATION_CHANNELS,
  SETTINGS_CHANNELS,
} from '../../shared/ipc-channels'

const CHANNEL_GROUPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  AI_CHANNELS,
  ATTACHMENT_CHANNELS,
  EXPORT_CHANNELS,
  NOTE_CHANNELS,
  ORGANIZATION_CHANNELS,
  SETTINGS_CHANNELS,
}

function resolveChannel(groupName: string, key: string): string {
  const channel = CHANNEL_GROUPS[groupName]?.[key]
  if (!channel) throw new Error(`Unknown IPC channel reference: ${groupName}.${key}`)
  return channel
}

function referencedChannels(source: string, expression: RegExp): string[] {
  return [...source.matchAll(expression)].map((match) => resolveChannel(match[1]!, match[2]!))
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('IPC allowlist and renderer boundary regression', () => {
  it('keeps every allowlisted channel unique, registered once and invoked only by preload', () => {
    const ipcDirectory = resolve('src/main/ipc')
    const handlerSource = readdirSync(ipcDirectory)
      .filter((name) => name.endsWith('-ipc.ts'))
      .map((name) => readFileSync(join(ipcDirectory, name), 'utf8'))
      .join('\n')
    const registered = referencedChannels(
      handlerSource,
      /ipcMain\.handle\(\s*([A-Z_]+)\.([a-zA-Z0-9_]+)/g,
    )
    const preloadSource = readFileSync(resolve('src/preload/index.ts'), 'utf8')
    const invoked = referencedChannels(
      preloadSource,
      /ipcRenderer\.invoke\(\s*([A-Z_]+)\.([a-zA-Z0-9_]+)/g,
    )
    const allowed = [...ALLOWED_IPC_CHANNELS].sort()

    expect(new Set(ALLOWED_IPC_CHANNELS).size).toBe(ALLOWED_IPC_CHANNELS.length)
    expect(new Set(registered).size).toBe(registered.length)
    expect(new Set(invoked).size).toBe(invoked.length)
    expect([...registered].sort()).toEqual(allowed)
    expect([...invoked].sort()).toEqual(allowed)
  })

  it('keeps renderer source free of privileged imports and raw HTML injection', () => {
    const rendererSources = sourceFiles(resolve('src/renderer'))
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n')
    const privilegedImport =
      /(?:from\s+|import\s*\()\s*['"](?:node:[^'"]+|electron|better-sqlite3|fs|path|os|child_process)['"]/

    expect(rendererSources).not.toMatch(privilegedImport)
    expect(rendererSources).not.toContain('dangerouslySetInnerHTML')
    expect(rendererSources).not.toContain('ipcRenderer')
  })
})
