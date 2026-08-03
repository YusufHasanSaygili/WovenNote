import { randomUUID } from 'node:crypto'

import type {
  CreateTagInput,
  SetNoteFlagInput,
  SetNoteTagsInput,
} from '../../shared/schemas/organization-contracts'
import type { Note } from '../../shared/schemas/note-contracts'
import type { Tag } from '../../shared/schemas/tag-schema'
import type { NoteRepository } from '../repositories/note-repository'
import type { TagRepository } from '../repositories/tag-repository'

export class OrganizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrganizationError'
  }
}

export interface OrganizationServiceDependencies {
  readonly createId?: () => string
  readonly now?: () => Date
}

export class OrganizationService {
  private readonly createId: () => string
  private readonly now: () => Date

  constructor(
    private readonly notes: NoteRepository,
    private readonly tags: TagRepository,
    dependencies: OrganizationServiceDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID
    this.now = dependencies.now ?? (() => new Date())
  }

  listTags(): Tag[] {
    return this.tags.list()
  }

  createTag(input: CreateTagInput): Tag {
    if (this.tags.findByName(input.name)) throw new OrganizationError('Bu etiket adı zaten var.')
    const tag: Tag = {
      id: this.createId(),
      name: input.name,
      color: input.color,
      createdAt: this.now().toISOString(),
    }
    this.tags.insert(tag)
    return tag
  }

  setNoteTags(input: SetNoteTagsInput): Note {
    this.tags.setForNote(input.noteId, input.tagIds)
    return this.requireNote(input.noteId)
  }

  setPinned(input: SetNoteFlagInput): Note {
    const note = this.notes.setPinned(input.id, input.value, this.now().toISOString())
    if (!note) throw new OrganizationError('Not bulunamadı.')
    return note
  }

  setFavorite(input: SetNoteFlagInput): Note {
    const note = this.notes.setFavorite(input.id, input.value, this.now().toISOString())
    if (!note) throw new OrganizationError('Not bulunamadı.')
    return note
  }

  private requireNote(id: string): Note {
    const note = this.notes.findById(id)
    if (!note || note.deletedAt || note.isArchived) throw new OrganizationError('Not bulunamadı.')
    return note
  }
}
