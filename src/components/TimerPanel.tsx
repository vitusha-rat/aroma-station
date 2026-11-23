import { plural } from '../domain'

const HOURS = Array.from({ length: 24 }, (_, index) => index + 1)

interface TimerPanelProps {
  on: boolean
  hours: number
  onChange: (on: boolean, hours: number) => Promise<boolean>
}

export function TimerPanel({ on, hours, onChange }: TimerPanelProps) {
  return (
    <section className="panel" aria-labelledby="timer-title">
      <div className="row-switch">
        <h2 id="timer-title">Выключить через</h2>
        <select
          className="field field-compact"
          aria-labelledby="timer-title"
          value={on ? hours : 0}
          onChange={(event) => {
            const next = Number(event.target.value)
            void onChange(next > 0, next || hours)
          }}
        >
          <option value={0}>Не выключать</option>
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hour} {plural(hour, 'час', 'часа', 'часов')}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}
