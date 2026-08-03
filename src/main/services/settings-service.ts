import {
  DEFAULT_DETAIL_LAYOUT,
  DetailLayoutSchema,
  type DetailLayout,
  type SetDetailLayoutInput,
} from '../../shared/schemas/detail-contracts'
import type { SettingsRepository } from '../repositories/settings-repository'

const DETAIL_LAYOUT_KEY = 'note-detail-layout'

export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getDetailLayout(): DetailLayout {
    const valueJson = this.repository.get(DETAIL_LAYOUT_KEY)
    if (!valueJson) return DEFAULT_DETAIL_LAYOUT

    try {
      const parsed = DetailLayoutSchema.safeParse(JSON.parse(valueJson))
      return parsed.success ? parsed.data : DEFAULT_DETAIL_LAYOUT
    } catch {
      return DEFAULT_DETAIL_LAYOUT
    }
  }

  setDetailLayout(input: SetDetailLayoutInput): DetailLayout {
    const detailLayout = DetailLayoutSchema.parse(input)
    this.repository.set(DETAIL_LAYOUT_KEY, JSON.stringify(detailLayout), this.now().toISOString())
    return detailLayout
  }
}
