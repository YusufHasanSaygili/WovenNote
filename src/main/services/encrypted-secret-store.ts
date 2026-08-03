import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface SecretEncryptionAdapter {
  readonly isAvailable: () => boolean
  readonly encrypt: (plainText: string) => Buffer
  readonly decrypt: (encrypted: Buffer) => string
}

export interface SecretStore {
  readonly isAvailable: () => boolean
  readonly has: () => boolean
  readonly read: () => string | null
  readonly remove: () => void
  readonly write: (secret: string) => void
}

export class EncryptedFileSecretStore implements SecretStore {
  constructor(
    private readonly filePath: string,
    private readonly encryption: SecretEncryptionAdapter,
  ) {}

  isAvailable(): boolean {
    return this.encryption.isAvailable()
  }

  has(): boolean {
    return this.isAvailable() && existsSync(this.filePath)
  }

  read(): string | null {
    if (!this.isAvailable()) throw new Error('Secure secret storage is unavailable.')
    if (!existsSync(this.filePath)) return null
    if (statSync(this.filePath).size > 64 * 1_024) throw new Error('Stored secret is invalid.')

    const secret = this.encryption.decrypt(readFileSync(this.filePath)).trim()
    if (!secret) throw new Error('Stored secret is invalid.')
    return secret
  }

  write(secret: string): void {
    if (!this.isAvailable()) throw new Error('Secure secret storage is unavailable.')
    const normalizedSecret = secret.trim()
    if (!normalizedSecret) throw new Error('Secret cannot be empty.')
    if (normalizedSecret.length > 512) throw new Error('Secret is too long.')

    const encrypted = this.encryption.encrypt(normalizedSecret)
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, encrypted, { mode: 0o600 })
  }

  remove(): void {
    rmSync(this.filePath, { force: true })
  }
}
