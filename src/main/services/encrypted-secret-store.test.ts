// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { EncryptedFileSecretStore, type SecretEncryptionAdapter } from './encrypted-secret-store'

const temporaryRoots: string[] = []

function fakeEncryption(available = true): SecretEncryptionAdapter {
  return {
    isAvailable: () => available,
    encrypt: (plainText) => Buffer.from(`encrypted:${Buffer.from(plainText).toString('base64')}`),
    decrypt: (encrypted) =>
      Buffer.from(encrypted.toString().replace(/^encrypted:/, ''), 'base64').toString(),
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe('EncryptedFileSecretStore', () => {
  it('persists only encrypted bytes and decrypts them on demand', () => {
    const root = mkdtempSync(join(tmpdir(), 'wovennote-secret-'))
    temporaryRoots.push(root)
    const secretPath = join(root, 'secrets', 'openai-api-key.bin')
    const store = new EncryptedFileSecretStore(secretPath, fakeEncryption())

    store.write('  sk-test-super-secret-value  ')

    expect(store.has()).toBe(true)
    expect(store.read()).toBe('sk-test-super-secret-value')
    expect(readFileSync(secretPath, 'utf8')).not.toContain('sk-test-super-secret-value')

    store.remove()
    expect(store.has()).toBe(false)
  })

  it('refuses plaintext fallback when secure encryption is unavailable', () => {
    const root = mkdtempSync(join(tmpdir(), 'wovennote-secret-'))
    temporaryRoots.push(root)
    const store = new EncryptedFileSecretStore(join(root, 'secret.bin'), fakeEncryption(false))

    expect(store.isAvailable()).toBe(false)
    expect(() => store.write('sk-test-super-secret-value')).toThrow(
      'Secure secret storage is unavailable.',
    )
    expect(store.has()).toBe(false)
  })
})
