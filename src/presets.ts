import { duration } from './domain'
import { parseRhythm } from './station/plan'

export const PRESETS_KEY = 'aroma-station.presets'

export interface Preset {
  id: string
  name: string
  work: number
  pause: number
  custom: boolean
}

export const BUILT_IN_PRESETS: Preset[] = [
  { id: 'soft', name: 'Мягко', work: 15, pause: 200, custom: false },
  { id: 'calm', name: 'Спокойно', work: 15, pause: 100, custom: false },
  { id: 'clear', name: 'Заметно', work: 15, pause: 60, custom: false },
  { id: 'rich', name: 'Насыщенно', work: 15, pause: 30, custom: false },
]

export function createPreset(work: number, pause: number): Preset {
  return { id: `${work}-${pause}`, name: `${duration(work)} и ${duration(pause)}`, work, pause, custom: true }
}

export function parsePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return []
  const presets = raw.flatMap((item) => {
    const { work, pause } = (item ?? {}) as Partial<Preset>
    const rhythm = parseRhythm(work, pause)
    return rhythm ? [createPreset(rhythm.work, rhythm.pause)] : []
  })
  return [...new Map(presets.map((preset) => [preset.id, preset])).values()]
}
