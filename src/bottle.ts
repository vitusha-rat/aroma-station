import { exactBottleDays, NAME_LIMIT } from './domain'
import type { DaySchedule } from './station/protocol'

export const BOTTLE_KEY = 'aroma-station.bottle'
export const FULL_BOTTLE_ML = 100

const DAY_MS = 86_400_000

export interface Bottle {
  name: string
  volume: number
  used: number
  since: number
  rate: number
}

export function mlPerDay(work: number, pause: number, week: DaySchedule[]) {
  const days = exactBottleDays(work, pause, week)
  return days ? FULL_BOTTLE_ML / days : 0
}

export const usedBy = (bottle: Bottle, now: number) =>
  bottle.used + (bottle.rate * Math.max(0, now - bottle.since)) / DAY_MS

export const remainingIn = (bottle: Bottle, now: number) => Math.max(0, bottle.volume - usedBy(bottle, now))

export const withRate = (bottle: Bottle, rate: number, now: number): Bottle => ({
  ...bottle,
  used: usedBy(bottle, now),
  since: now,
  rate,
})

export const resumedAt = (bottle: Bottle, savedAt: number, now: number): Bottle => ({
  ...bottle,
  used: usedBy(bottle, savedAt),
  since: now,
})

export function parseBottle(raw: unknown): Bottle | null {
  const { name, volume, used, since, rate } = (raw ?? {}) as Partial<Bottle>
  const valid =
    typeof name === 'string' &&
    typeof volume === 'number' &&
    volume > 0 &&
    volume <= FULL_BOTTLE_ML &&
    typeof used === 'number' &&
    used >= 0 &&
    typeof since === 'number' &&
    since > 0 &&
    typeof rate === 'number' &&
    rate >= 0
  return valid ? { name: name.slice(0, NAME_LIMIT), volume, used, since, rate } : null
}
