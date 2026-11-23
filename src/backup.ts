import { BOTTLE_KEY, parseBottle, resumedAt, type Bottle } from './bottle'
import { parsePresets, PRESETS_KEY, type Preset } from './presets'
import { AWAY_KEY, parseAwayDays, parseScenes, SCENES_KEY, type CustomScene } from './scenes'
import { parsePlan, type StationPlan } from './station/plan'
import { store } from './storage'

const BACKUP_VERSION = 1
const REVOKE_DELAY_MS = 1000

export interface Backup {
  version: number
  savedAt: string
  station: StationPlan
  rhythmActive: boolean
  awayDays: number[] | null | undefined
  presets: Preset[] | undefined
  scenes: CustomScene[] | undefined
  bottle: Bottle | null | undefined
}

export function parseBackup(raw: unknown): Backup | null {
  const { version, savedAt, station, rhythmActive, awayDays, presets, scenes, bottle } = (raw ?? {}) as Partial<
    Record<keyof Backup, unknown>
  >
  const plan = parsePlan(station)
  if (version !== BACKUP_VERSION || typeof savedAt !== 'string' || Number.isNaN(Date.parse(savedAt)) || !plan) {
    return null
  }
  return {
    version: BACKUP_VERSION,
    savedAt,
    station: plan,
    rhythmActive: rhythmActive !== false,
    awayDays: awayDays === null ? null : (parseAwayDays(awayDays) ?? undefined),
    presets: Array.isArray(presets) ? parsePresets(presets) : undefined,
    scenes: Array.isArray(scenes) ? parseScenes(scenes) : undefined,
    bottle: bottle === null ? null : (parseBottle(bottle) ?? undefined),
  }
}

export function downloadBackup(content: Omit<Backup, 'version' | 'savedAt'>) {
  const now = new Date()
  const backup: Backup = { version: BACKUP_VERSION, savedAt: now.toISOString(), ...content }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `aroma-station-${now.toISOString().slice(0, 10)}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export function restoreLocal({ awayDays, presets, scenes, bottle, savedAt }: Backup) {
  if (awayDays !== undefined) store(AWAY_KEY, awayDays)
  if (presets) store(PRESETS_KEY, presets)
  if (scenes) store(SCENES_KEY, scenes)
  if (bottle !== undefined) {
    store(BOTTLE_KEY, bottle && resumedAt(bottle, Date.parse(savedAt), Date.now()))
  }
}
