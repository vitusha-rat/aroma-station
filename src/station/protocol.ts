export const STATION_NAMES = ['AJBLE19', '3004Aroma'] as const
export const SERVICE_UUID = 'edfec62e-9910-0bac-5241-d8bda6932a2f'
export const WRITE_UUID = '0783b03e-8535-b5a0-7140-a304d2495cba'
export const NOTIFY_UUID = '0783b03e-8535-b5a0-7140-a304d2495cb8'

const HEADER = 0xa5
const COMMAND = { clock: 1, timer: 2, power: 4, day: 5, light: 6, rhythm: 7, query: 8, session: 9 } as const
const REPORT = { status: 0xa6, rhythm: 0xa7, day: 0xa8 } as const
const REPORT_LENGTH = { [REPORT.status]: 20, [REPORT.rhythm]: 16, [REPORT.day]: 10 } as const

export const CUSTOM_MODE = 6
export const weekDayOf = (date: Date) => date.getDay() || 7

export interface LightState {
  on: boolean
  motion: boolean
  brightness: number
  r: number
  g: number
  b: number
}

export interface StationStatus {
  power: boolean
  mode: number
  timerOn: boolean
  timerHours: number
  light: LightState
  battery: number
}

export interface Rhythm {
  on: boolean
  work: number
  pause: number
}

export interface DaySchedule {
  week: number
  open: boolean
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
}

export type Report =
  | { kind: 'status'; status: StationStatus }
  | { kind: 'rhythm'; rhythm: Rhythm }
  | { kind: 'day'; day: DaySchedule }

const flag = (value: boolean) => (value ? 1 : 0)
const checksum = (bytes: ArrayLike<number>, length = bytes.length) => {
  let sum = 0
  for (let i = 0; i < length; i++) sum += bytes[i] ?? 0
  return sum & 0xff
}

function packet(command: number, data: number[]) {
  const body = [HEADER, command, data.length + 1, ...data]
  return Uint8Array.from([...body, checksum(body)])
}

export const encode = {
  query: () => packet(COMMAND.query, [0, 0]),
  session: (open: boolean) => packet(COMMAND.session, [flag(open)]),
  power: (on: boolean) => packet(COMMAND.power, [flag(on), 0]),
  timer: (on: boolean, hours: number) => packet(COMMAND.timer, [flag(on), hours, 0, 0, 0]),
  clock: (date: Date) =>
    packet(COMMAND.clock, [
      date.getFullYear() - 2000,
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      weekDayOf(date),
    ]),
  days: (days: DaySchedule[]) =>
    Uint8Array.from(
      days.flatMap((day) => [
        ...packet(COMMAND.day, [
          day.week,
          flag(day.open),
          day.startHour,
          day.startMinute,
          day.endHour,
          day.endMinute,
        ]),
      ]),
    ),
  light: (light: LightState) =>
    packet(COMMAND.light, [flag(light.on), light.r, light.g, light.b, light.brightness, flag(light.motion)]),
  rhythm: ({ on, work, pause }: Rhythm) =>
    packet(COMMAND.rhythm, [flag(on), work >> 8, work & 0xff, pause >> 8, pause & 0xff, 0, 0, 0]),
}

export function decodeReport(bytes: Uint8Array): Report | null {
  const at = (index: number) => bytes[index] ?? 0
  const type = at(0)
  const length = REPORT_LENGTH[type as keyof typeof REPORT_LENGTH]
  if (bytes.length !== length || checksum(bytes, length - 1) !== at(length - 1)) return null

  if (type === REPORT.rhythm) {
    return {
      kind: 'rhythm',
      rhythm: { on: at(10) !== 0, work: (at(1) << 8) | at(2), pause: (at(3) << 8) | at(4) },
    }
  }
  if (type === REPORT.day) {
    return {
      kind: 'day',
      day: {
        week: at(1),
        open: at(2) !== 0,
        startHour: at(3),
        startMinute: at(4),
        endHour: at(5),
        endMinute: at(6),
      },
    }
  }
  const lightBits = at(8)
  return {
    kind: 'status',
    status: {
      power: (at(1) & 1) === 1,
      mode: at(1) >> 1,
      timerOn: at(3) !== 0,
      timerHours: at(4) || 1,
      battery: at(13),
      light: {
        on: (lightBits & 1) === 1,
        motion: ((lightBits >> 5) & 1) === 1,
        brightness: (lightBits >> 2) & 7,
        r: at(9),
        g: at(10),
        b: at(11),
      },
    },
  }
}
