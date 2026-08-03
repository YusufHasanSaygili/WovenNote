import type Database from 'better-sqlite3'

import type { ChatMessage } from '../../shared/schemas/ai-chat-contracts'

export interface ChatSessionRecord {
  readonly id: string
  readonly noteId: string
  readonly title: string
  readonly createdAt: string
  readonly updatedAt: string
}

export class ChatRepository {
  constructor(private readonly database: Database.Database) {}

  findLatestSession(noteId: string): ChatSessionRecord | null {
    return (
      (this.database
        .prepare(
          `SELECT id, noteId, title, createdAt, updatedAt
           FROM ChatSessions
           WHERE noteId = ?
           ORDER BY updatedAt DESC, id DESC
           LIMIT 1`,
        )
        .get(noteId) as ChatSessionRecord | undefined) ?? null
    )
  }

  insertSession(session: ChatSessionRecord): void {
    this.database
      .prepare(
        `INSERT INTO ChatSessions (id, noteId, title, createdAt, updatedAt)
         VALUES (@id, @noteId, @title, @createdAt, @updatedAt)`,
      )
      .run(session)
  }

  insertMessage(message: ChatMessage): void {
    this.database
      .prepare(
        `INSERT INTO ChatMessages (id, sessionId, role, content, status, createdAt)
         VALUES (@id, @sessionId, @role, @content, @status, @createdAt)`,
      )
      .run(message)
  }

  updateMessage(
    id: string,
    update: Pick<ChatMessage, 'content' | 'status'>,
    sessionUpdatedAt: string,
  ): void {
    const transaction = this.database.transaction(() => {
      const result = this.database
        .prepare('UPDATE ChatMessages SET content = ?, status = ? WHERE id = ?')
        .run(update.content, update.status, id)
      if (result.changes !== 1) throw new Error('Chat message not found.')

      this.database
        .prepare(
          `UPDATE ChatSessions SET updatedAt = ?
           WHERE id = (SELECT sessionId FROM ChatMessages WHERE id = ?)`,
        )
        .run(sessionUpdatedAt, id)
    })
    transaction()
  }

  listMessages(sessionId: string, limit = 100): ChatMessage[] {
    return this.database
      .prepare(
        `SELECT id, sessionId, role, content, status, createdAt
         FROM (
           SELECT id, sessionId, role, content, status, createdAt, rowid AS sortRow
           FROM ChatMessages
           WHERE sessionId = ?
           ORDER BY createdAt DESC, rowid DESC
           LIMIT ?
         )
         ORDER BY createdAt ASC, sortRow ASC`,
      )
      .all(sessionId, limit) as ChatMessage[]
  }

  findCompletedAssistantMessage(noteId: string, messageId: string): ChatMessage | null {
    return (
      (this.database
        .prepare(
          `SELECT message.id, message.sessionId, message.role, message.content,
                  message.status, message.createdAt
           FROM ChatMessages AS message
           INNER JOIN ChatSessions AS session ON session.id = message.sessionId
           WHERE session.noteId = ? AND message.id = ?
             AND message.role = 'assistant' AND message.status = 'complete'
           LIMIT 1`,
        )
        .get(noteId, messageId) as ChatMessage | undefined) ?? null
    )
  }

  markPendingMessagesCancelled(sessionId: string): number {
    const result = this.database
      .prepare(
        `UPDATE ChatMessages
         SET status = 'cancelled', content = 'Önceki AI isteği tamamlanmadan uygulama kapatıldı.'
         WHERE sessionId = ? AND status = 'pending'`,
      )
      .run(sessionId)
    return result.changes
  }
}
