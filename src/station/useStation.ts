import { useCallback, useEffect, useRef, useState } from 'react'
import { StationLink } from './link'
import { fitRhythm, sameLight, samePlan, type StationPlan } from './plan'
import {
  encode,
  type DaySchedule,
  type LightState,
  type Report,
  type Rhythm,
  type StationStatus,
} from './protocol'

const READ_ATTEMPTS = 5
const READ_WAIT_MS = 1500
const SETTLE_MS = 150
const REPEAT_GAP_MS = 220
const REPEAT_SETTLE_MS = 280
const DAYS_IN_WEEK = 7

const CONNECT_FAILED =
  'Не получилось подключиться. Удержи кнопку с солнцем 3 секунды и закрой Fragrant Pro на телефоне.'
const SEND_FAILED = 'Станция не подтвердила изменение. Проверь, что она рядом, и повтори.'
const LIGHT_FAILED = 'Подсветка не изменилась. Попробуй ещё раз.'
const PLAN_FAILED = 'Станция применила не все настройки. Проверь их на экране.'

export type Phase = 'idle' | 'connecting' | 'ready' | 'lost'

export interface StationData {
  status: StationStatus
  rhythm: Rhythm
  week: DaySchedule[]
}

export interface StationView {
  phase: Phase
  error: string | null
  notice: string | null
  busy: boolean
  data: StationData | null
}

interface Collector {
  status?: StationStatus
  rhythm?: Rhythm
  days: Map<number, DaySchedule>
  finish: (data: StationData | null) => void
}

interface Step {
  packet: Uint8Array<ArrayBuffer>
  repeat?: boolean
  skip?: () => boolean
}

const INITIAL: StationView = { phase: 'idle', error: null, notice: null, busy: false, data: null }
const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
const lightStep = (light: LightState): Step => ({ packet: encode.light(light), repeat: true })

export const planOf = ({ rhythm, status, week }: StationData): StationPlan => ({
  work: rhythm.work,
  pause: rhythm.pause,
  light: status.light,
  week,
})

function collect(collector: Collector, report: Report) {
  if (report.kind === 'status') collector.status = report.status
  if (report.kind === 'rhythm') collector.rhythm = report.rhythm
  if (report.kind === 'day') collector.days.set(report.day.week, report.day)
  const { status, rhythm, days } = collector
  if (status && rhythm && days.size === DAYS_IN_WEEK) {
    collector.finish({ status, rhythm, week: [...days.values()].sort((a, b) => a.week - b.week) })
  }
}

function merge(data: StationData, report: Report): StationData {
  if (report.kind === 'status') return { ...data, status: report.status }
  if (report.kind === 'rhythm') return { ...data, rhythm: report.rhythm }
  return { ...data, week: data.week.map((day) => (day.week === report.day.week ? report.day : day)) }
}

export function useStation() {
  const [view, setView] = useState(INITIAL)
  const current = useRef(view)
  const collector = useRef<Collector | null>(null)
  const pending = useRef(0)
  const confirmed = useRef<StationData | null>(null)
  const session = useRef(0)
  const lightVersion = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const linkRef = useRef<StationLink | null>(null)

  const update = useCallback((patch: Partial<StationView>) => {
    current.current = { ...current.current, ...patch }
    setView(current.current)
  }, [])

  const link = useCallback(() => {
    linkRef.current ??= new StationLink({
      onReport: (report) => {
        if (collector.current) return collect(collector.current, report)
        const { data } = current.current
        if (data && pending.current === 0) {
          confirmed.current = merge(data, report)
          update({ data: confirmed.current })
        }
      },
      onLost: () => {
        collector.current?.finish(null)
        if (current.current.phase === 'ready') update({ phase: 'lost' })
      },
    })
    return linkRef.current
  }, [update])

  const readOnce = useCallback(
    () =>
      new Promise<StationData | null>((resolve) => {
        const finish = (data: StationData | null) => {
          window.clearTimeout(timer)
          if (collector.current === own) collector.current = null
          resolve(data)
        }
        const own: Collector = { days: new Map(), finish }
        const timer = window.setTimeout(() => finish(null), READ_WAIT_MS)
        collector.current = own
        link()
          .send(encode.query())
          .catch(() => finish(null))
      }),
    [link],
  )

  const read = useCallback(async () => {
    for (let attempt = 0; attempt < READ_ATTEMPTS && link().connected; attempt++) {
      const data = await readOnce()
      if (data) return data
    }
    return null
  }, [link, readOnce])

  const command = useCallback(
    (...steps: Step[]) => {
      pending.current += 1
      update({ busy: true, notice: null })
      const started = session.current
      const assertSession = () => {
        if (session.current !== started) throw new Error('Connection changed')
      }
      const run = queue.current.then(async () => {
        const live = steps.filter((step) => !step.skip?.())
        let data: StationData | null = live.length === 0 ? confirmed.current : null
        try {
          for (const step of live) {
            assertSession()
            await link().send(step.packet)
            if (step.repeat) {
              await delay(REPEAT_GAP_MS)
              assertSession()
              await link().send(step.packet)
              await delay(REPEAT_SETTLE_MS)
            }
          }
          if (live.length > 0) {
            await delay(SETTLE_MS)
            assertSession()
            data = await read()
          }
        } catch {
          data = null
        }
        pending.current -= 1
        if (data) confirmed.current = data
        const sameSession = session.current === started
        if (sameSession && current.current.phase === 'ready' && live.length > 0) {
          update({ notice: data ? null : SEND_FAILED })
        }
        if (pending.current === 0) {
          update(sameSession && confirmed.current ? { busy: false, data: confirmed.current } : { busy: false })
        }
        return data
      })
      queue.current = run
      return run
    },
    [link, read, update],
  )

  const start = useCallback(
    async (choose: boolean) => {
      const previous = current.current.phase
      session.current += 1
      update({ phase: 'connecting', error: null, notice: null })
      if (choose) {
        try {
          await link().choose()
        } catch (error) {
          const cancelled = error instanceof DOMException && error.name === 'NotFoundError'
          update({ phase: previous, error: cancelled ? null : CONNECT_FAILED })
          return
        }
      }
      try {
        await link().open()
        const data = await read()
        if (!data || !link().connected) throw new Error('Station did not answer')
        confirmed.current = data
        update({ phase: 'ready', data })
      } catch {
        await link().close()
        update({ phase: current.current.data ? 'lost' : 'idle', error: CONNECT_FAILED })
      }
    },
    [link, read, update],
  )

  const applyStatus = useCallback(
    async (patch: Partial<StationStatus>, step: Step) => {
      const before = current.current.data
      if (!before) return null
      update({ data: { ...before, status: { ...before.status, ...patch } } })
      return command(step)
    },
    [command, update],
  )

  const isOn = useCallback(() => current.current.data?.status.power === true, [])

  const saveRhythm = useCallback(
    async (work: number, pause: number) => {
      if (!isOn()) return null
      const data = await command({ packet: encode.rhythm({ on: true, work, pause }) })
      return data?.rhythm ?? null
    },
    [command, isOn],
  )

  const saveDays = useCallback(
    async (days: DaySchedule[]) => isOn() && (await command({ packet: encode.days(days) })) !== null,
    [command, isOn],
  )

  const applyPlan = useCallback(
    async (plan: StationPlan, writeRhythm = true) => {
      const before = current.current.data
      if (!before || !isOn()) return false
      const rhythm = writeRhythm ? fitRhythm(plan.work, plan.pause) : before.rhythm
      const target = { ...plan, work: rhythm.work, pause: rhythm.pause }
      update({ data: { ...before, status: { ...before.status, light: plan.light } } })
      const data = await command(
        ...(writeRhythm ? [{ packet: encode.rhythm({ on: true, work: rhythm.work, pause: rhythm.pause }) }] : []),
        { packet: encode.days(plan.week) },
        lightStep(plan.light),
      )
      if (!data) return false
      if (samePlan(planOf(data), target)) return true
      update({ notice: PLAN_FAILED })
      return false
    },
    [command, isOn, update],
  )

  const setPower = useCallback(
    async (on: boolean) => (await applyStatus({ power: on }, { packet: encode.power(on) })) !== null,
    [applyStatus],
  )

  const setTimer = useCallback(
    async (on: boolean, hours: number) =>
      isOn() &&
      (await applyStatus({ timerOn: on, timerHours: hours }, { packet: encode.timer(on, hours) })) !== null,
    [applyStatus, isOn],
  )

  const setLight = useCallback(
    async (patch: Partial<LightState>) => {
      const light = current.current.data?.status.light
      if (!light || !isOn()) return false
      const next = { ...light, ...patch }
      const version = ++lightVersion.current
      const superseded = () => version !== lightVersion.current
      const result = await applyStatus({ light: next }, { ...lightStep(next), skip: superseded })
      if (superseded()) return true
      if (!result) return false
      if (sameLight(result.status.light, next)) return true
      update({ notice: LIGHT_FAILED })
      return false
    },
    [applyStatus, isOn, update],
  )

  const connect = useCallback(() => start(true), [start])
  const reconnect = useCallback(() => start(false), [start])
  const disconnect = useCallback(async () => {
    session.current += 1
    confirmed.current = null
    update({ ...INITIAL })
    collector.current?.finish(null)
    await link().close()
  }, [link, update])

  useEffect(() => {
    const closeOnLeave = () => {
      if (current.current.phase !== 'ready') return
      void linkRef.current?.close()
      update({ phase: 'lost' })
    }
    window.addEventListener('pagehide', closeOnLeave)
    return () => window.removeEventListener('pagehide', closeOnLeave)
  }, [update])

  return {
    ...view,
    connect,
    reconnect,
    disconnect,
    saveRhythm,
    saveDays,
    applyPlan,
    setPower,
    setTimer,
    setLight,
  }
}

export type Station = ReturnType<typeof useStation>
