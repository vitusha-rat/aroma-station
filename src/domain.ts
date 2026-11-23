import { weekDayOf, type DaySchedule } from './station/protocol'

const BOTTLE_FACTOR = 4.4
const MANUAL_HOURS_PER_DAY = 8
const WEEKDAYS_IN = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье']

export const MINUTES_IN_DAY = 1440
export const NAME_LIMIT = 40
export const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const startOf = (day: DaySchedule) => day.startHour * 60 + day.startMinute
export const endOf = (day: DaySchedule) => day.endHour * 60 + day.endMinute
export const minuteOf = (date: Date) => date.getHours() * 60 + date.getMinutes()

export function windowsOf(day: DaySchedule) {
  const start = startOf(day)
  const end = endOf(day)
  return start <= end
    ? [{ from: start, to: end }]
    : [
        { from: start, to: MINUTES_IN_DAY },
        { from: 0, to: end },
      ]
}

const pad = (value: number) => String(value).padStart(2, '0')
export const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

export function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100
  const units = value % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}

export function duration(seconds: number) {
  if (seconds < 120) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`
}

export const spraysPerHour = (work: number, pause: number) =>
  work + pause > 0 ? Math.round(3600 / (work + pause)) : 0

export function exactBottleDays(work: number, pause: number, week: DaySchedule[]) {
  const minutes = week
    .filter((day) => day.open)
    .flatMap(windowsOf)
    .reduce((sum, window) => sum + window.to - window.from, 0)
  if (minutes === 0 || work <= 0) return null
  const hoursPerDay = minutes / 60 / week.length
  const share = work / (work + pause)
  return (BOTTLE_FACTOR / share) * (MANUAL_HOURS_PER_DAY / hoursPerDay)
}

export function bottleDays(work: number, pause: number, week: DaySchedule[]) {
  const days = exactBottleDays(work, pause, week)
  return days === null ? null : Math.round(days)
}

export function runState(power: boolean, week: DaySchedule[], now: Date) {
  if (!power) return { running: false, label: 'Станция выключена' }
  const today = weekDayOf(now)
  const minute = minuteOf(now)
  const todayPlan = week.find((day) => day.week === today)
  const activeWindow = todayPlan?.open
    ? windowsOf(todayPlan).find((window) => minute >= window.from && minute <= window.to)
    : undefined
  if (todayPlan && activeWindow) return { running: true, label: `Работает до ${clock(endOf(todayPlan))}` }

  for (let offset = 0; offset <= 7; offset++) {
    const weekDay = ((today - 1 + offset) % 7) + 1
    const plan = week.find((day) => day.week === weekDay)
    if (!plan?.open || (offset === 0 && minute >= startOf(plan))) continue
    const when =
      offset === 0 ? 'сегодня' : offset === 1 ? 'завтра' : offset === 7 ? 'через неделю' : WEEKDAYS_IN[weekDay - 1]
    return { running: false, label: `Запустится ${when} в ${clock(startOf(plan))}` }
  }
  return { running: false, label: 'В расписании нет рабочих дней' }
}
