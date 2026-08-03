import type Database from 'better-sqlite3'

interface SettingRow {
  readonly valueJson: string
}

export class SettingsRepository {
  constructor(private readonly database: Database.Database) {}

  get(key: string): string | null {
    const row = this.database.prepare('SELECT valueJson FROM Settings WHERE key = ?').get(key) as
      SettingRow | undefined

    return row?.valueJson ?? null
  }

  set(key: string, valueJson: string, updatedAt: string): void {
    this.database
      .prepare(
        `INSERT INTO Settings (key, valueJson, updatedAt)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson, updatedAt = excluded.updatedAt`,
      )
      .run(key, valueJson, updatedAt)
  }
}
