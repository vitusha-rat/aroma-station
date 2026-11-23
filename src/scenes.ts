import { NAME_LIMIT } from './domain'
import { parsePlan, type StationPlan } from './station/plan'
import type { DaySchedule, LightState } from './station/protocol'

export const SCENES_KEY = 'aroma-station.scenes'
export const AWAY_KEY = 'aroma-station.away-days'

export interface CustomScene {
  id: string
  name: string
  plan: StationPlan
}

interface BuiltInScene {
  id: string
  name: string
  rhythm?: { work: number; pause: number }
  light: Partial<LightState>
  away?: boolean
}

export const BUILT_IN_SCENES: BuiltInScene[] = [
  { id: 'day', name: 'Обычный день', rhythm: { work: 15, pause: 100 }, light: { on: false } },
  {
    id: 'guests',
    name: 'Гости',
    rhythm: { work: 15, pause: 60 },
    light: { on: true, r: 0xcc, g: 0xed, b: 0xfe, brightness: 2, motion: false },
  },
  { id: 'night', name: 'На ночь', rhythm: { work: 15, pause: 200 }, light: { on: false } },
  { id: 'away', name: 'Нет дома', light: { on: false }, away: true },
]

export const hasOpenDays = (week: DaySchedule[]) => week.some((day) => day.open)
export const openDaysOf = (week: DaySchedule[]) => week.filter((day) => day.open).map((day) => day.week)

export const parseAwayDays = (raw: unknown): number[] | null =>
  Array.isArray(raw) && raw.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) ? raw : null

function weekFor(scene: BuiltInScene, week: DaySchedule[], awayDays: number[] | null) {
  if (scene.away) return week.map((day) => ({ ...day, open: false }))
  if (!awayDays || hasOpenDays(week)) return week
  return week.map((day) => ({ ...day, open: awayDays.includes(day.week) }))
}

export function builtInPlan(scene: BuiltInScene, current: StationPlan, awayDays: number[] | null): StationPlan {
  return {
    work: scene.rhythm?.work ?? current.work,
    pause: scene.rhythm?.pause ?? current.pause,
    light: { ...current.light, ...scene.light },
    week: weekFor(scene, current.week, awayDays),
  }
}

export function parseScenes(raw: unknown): CustomScene[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const { id, name, plan } = (item ?? {}) as Partial<CustomScene>
    const parsed = parsePlan(plan)
    return typeof id === 'string' && typeof name === 'string' && name.trim() && parsed
      ? [{ id, name: name.trim().slice(0, NAME_LIMIT), plan: parsed }]
      : []
  })
}
