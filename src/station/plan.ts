import type { DaySchedule, LightState } from './protocol'

export const WORK_RANGE = { min: 10, max: 120 }
export const PAUSE_RANGE = { min: 15, max: 3600 }
export const MAX_BRIGHTNESS = 3

const REPORTED_BRIGHTNESS_MAX = 7

export interface StationPlan {
  work: number
  pause: number
  light: LightState
  week: DaySchedule[]
}

export const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.min(Math.max(value, min), max)

export const fitRhythm = (work: number, pause: number) => ({
  work: clamp(work, WORK_RANGE),
  pause: clamp(pause, PAUSE_RANGE),
})

export function parseRhythm(work: unknown, pause: unknown) {
  return Number.isInteger(work) && Number.isInteger(pause) ? fitRhythm(work as number, pause as number) : null
}

export const sameLight = (a: LightState, b: LightState) =>
  a.on === b.on &&
  a.motion === b.motion &&
  a.brightness === b.brightness &&
  a.r === b.r &&
  a.g === b.g &&
  a.b === b.b

const sameHours = (a: DaySchedule, b: DaySchedule) =>
  a.startHour === b.startHour &&
  a.startMinute === b.startMinute &&
  a.endHour === b.endHour &&
  a.endMinute === b.endMinute

const sameWeek = (a: DaySchedule[], b: DaySchedule[], same: (x: DaySchedule, y: DaySchedule) => boolean) =>
  a.length === b.length && a.every((day, index) => same(day, b[index]!))

export const samePlan = (a: StationPlan, b: StationPlan) =>
  a.work === b.work &&
  a.pause === b.pause &&
  sameLight(a.light, b.light) &&
  sameWeek(a.week, b.week, (x, y) => x.week === y.week && x.open === y.open && sameHours(x, y))

export const sameEffect = (a: StationPlan, b: StationPlan) =>
  a.work === b.work &&
  a.pause === b.pause &&
  (a.light.on || b.light.on ? sameLight(a.light, b.light) : true) &&
  sameWeek(a.week, b.week, (x, y) => x.week === y.week && x.open === y.open && (!x.open || sameHours(x, y)))

function parseLight(raw: unknown): LightState | null {
  const { on, motion, brightness, r, g, b } = (raw ?? {}) as Partial<LightState>
  if (typeof on !== 'boolean' || typeof motion !== 'boolean') return null
  if (!inRange(brightness, 0, REPORTED_BRIGHTNESS_MAX)) return null
  if (!inRange(r, 0, 255) || !inRange(g, 0, 255) || !inRange(b, 0, 255)) return null
  return { on, motion, brightness: brightness & MAX_BRIGHTNESS, r, g, b }
}

function parseDay(raw: unknown, week: number): DaySchedule | null {
  const day = (raw ?? {}) as Partial<DaySchedule>
  if (day.week !== week || typeof day.open !== 'boolean') return null
  if (!inRange(day.startHour, 0, 23) || !inRange(day.endHour, 0, 23)) return null
  if (!inRange(day.startMinute, 0, 59) || !inRange(day.endMinute, 0, 59)) return null
  return {
    week,
    open: day.open,
    startHour: day.startHour,
    startMinute: day.startMinute,
    endHour: day.endHour,
    endMinute: day.endMinute,
  }
}

export function parsePlan(raw: unknown): StationPlan | null {
  const { work, pause, light, week } = (raw ?? {}) as Partial<Record<keyof StationPlan, unknown>>
  const rhythm = parseRhythm(work, pause)
  const parsedLight = parseLight(light)
  if (!rhythm || !parsedLight || !Array.isArray(week) || week.length !== 7) return null
  const days = week.map((day, index) => parseDay(day, index + 1))
  if (days.some((day) => day === null)) return null
  return { ...rhythm, light: parsedLight, week: days as DaySchedule[] }
}
