import { useState } from 'react'
import { clock, DAY_SHORT, endOf, minuteOf, MINUTES_IN_DAY, startOf, windowsOf } from '../domain'
import { weekDayOf, type DaySchedule } from '../station/protocol'
import { Switch } from './Switch'

const GROUPS = [
  { label: 'Будни', days: [1, 2, 3, 4, 5] },
  { label: 'Выходные', days: [6, 7] },
  { label: 'Все дни', days: [1, 2, 3, 4, 5, 6, 7] },
]

interface Draft {
  open: boolean
  start: string
  end: string
  edited: boolean
}

const hasMixedHours = (days: DaySchedule[]) =>
  new Set(days.map((day) => `${startOf(day)}-${endOf(day)}`)).size > 1

function draftFor(days: DaySchedule[]): Draft {
  const first = days[0]!
  const mixed = hasMixedHours(days)
  return {
    open: days.every((day) => day.open),
    start: mixed ? '' : clock(startOf(first)),
    end: mixed ? '' : clock(endOf(first)),
    edited: false,
  }
}

function problemIn(draft: Draft, days: DaySchedule[]) {
  if (!draft.open) return null
  if (!draft.start && !draft.end && hasMixedHours(days)) {
    return days.some((day) => startOf(day) === endOf(day)) ? 'Укажи время работы.' : null
  }
  if (!draft.start || !draft.end) return 'Укажи и начало, и конец.'
  if (draft.end <= draft.start) return 'Время окончания должно быть позже начала.'
  return null
}

function applyDraft(day: DaySchedule, draft: Draft): DaySchedule {
  if (!draft.open || !draft.start || !draft.end) return { ...day, open: draft.open }
  const [startHour = 0, startMinute = 0] = draft.start.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = draft.end.split(':').map(Number)
  return { ...day, open: true, startHour, startMinute, endHour, endMinute }
}

interface WeekPanelProps {
  week: DaySchedule[]
  now: Date
  onSave: (days: DaySchedule[]) => Promise<boolean>
}

export function WeekPanel({ week, now, onSave }: WeekPanelProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [seenWeek, setSeenWeek] = useState(week)
  const today = weekDayOf(now)
  const nowShare = (minuteOf(now) / MINUTES_IN_DAY) * 100

  if (seenWeek !== week) {
    setSeenWeek(week)
    const picked = week.filter((day) => selected.includes(day.week))
    if (draft && !draft.edited && picked.length > 0) setDraft(draftFor(picked))
  }

  const select = (days: number[]) => {
    setSelected(days)
    const picked = week.filter((day) => days.includes(day.week))
    setDraft((previous) => (picked.length === 0 ? null : previous?.edited ? previous : draftFor(picked)))
  }

  const toggle = (weekDay: number) => {
    select(
      selected.includes(weekDay)
        ? selected.filter((day) => day !== weekDay)
        : [...selected, weekDay].sort((a, b) => a - b),
    )
  }

  const edit = (patch: Partial<Draft>) => setDraft((previous) => previous && { ...previous, ...patch, edited: true })
  const pickedDays = week.filter((day) => selected.includes(day.week))
  const problem = draft && problemIn(draft, pickedDays)

  const submit = async () => {
    if (!draft || problem) return
    setSaving(true)
    const saved = await onSave(pickedDays.map((day) => applyDraft(day, draft)))
    setSaving(false)
    if (saved) {
      setSelected([])
      setDraft(null)
    }
  }

  return (
    <section className="panel" aria-labelledby="week-title">
      <h2 id="week-title">Расписание</h2>
      <div className="week">
        {week.map((day) => {
          const isSelected = selected.includes(day.week)
          return (
            <button
              key={day.week}
              className={isSelected ? 'day day-selected' : 'day'}
              aria-pressed={isSelected}
              onClick={() => toggle(day.week)}
            >
              <span className={day.week === today ? 'day-name day-today' : 'day-name'}>
                {DAY_SHORT[day.week - 1]}
              </span>
              <span className="day-track" aria-hidden="true">
                {day.open &&
                  windowsOf(day).map((window) => (
                    <span
                      key={window.from}
                      className="day-window"
                      style={{
                        left: `${(window.from / MINUTES_IN_DAY) * 100}%`,
                        width: `${(Math.max(window.to - window.from, 1) / MINUTES_IN_DAY) * 100}%`,
                      }}
                    />
                  ))}
                {day.week === today && <span className="day-now" style={{ left: `${nowShare}%` }} />}
              </span>
              <span className="day-hours">
                {day.open ? `${clock(startOf(day))}–${clock(endOf(day))}` : 'выключено'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="chips" role="group" aria-label="Выбрать дни">
        {GROUPS.map((group) => (
          <span key={group.label} className="chip">
            <button onClick={() => select(group.days)}>{group.label}</button>
          </span>
        ))}
      </div>

      {draft && selected.length > 0 && (
        <div className="editor">
          <div className="row-switch">
            <span id="week-open">Работать в {selected.length > 1 ? 'эти дни' : 'этот день'}</span>
            <Switch labelledBy="week-open" checked={draft.open} onChange={(open) => edit({ open })} />
          </div>
          {draft.open && (
            <div className="times">
              <label>
                <span>С</span>
                <input type="time" value={draft.start} onChange={(event) => edit({ start: event.target.value })} />
              </label>
              <label>
                <span>До</span>
                <input type="time" value={draft.end} onChange={(event) => edit({ end: event.target.value })} />
              </label>
            </div>
          )}
          {draft.open && !draft.start && !draft.end && hasMixedHours(pickedDays) && (
            <p className="editor-hint">У этих дней разное время. Оставь поля пустыми, чтобы его не менять.</p>
          )}
          {problem && (
            <p className="message message-alert" role="alert">
              {problem}
            </p>
          )}
          <button
            className="button button-main"
            disabled={!draft.edited || Boolean(problem) || saving}
            onClick={() => void submit()}
          >
            {saving ? 'Сохраняю' : 'Сохранить расписание'}
          </button>
        </div>
      )}
    </section>
  )
}
