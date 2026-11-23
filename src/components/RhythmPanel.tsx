import { useMemo, useRef, useState } from 'react'
import { bottleDays, duration, plural, spraysPerHour } from '../domain'
import { fitRhythm } from '../station/plan'
import type { DaySchedule, Rhythm } from '../station/protocol'
import { Chip } from './Chip'
import { usePresets } from './usePresets'

const WORK_STEPS = [10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120]
const PAUSE_STEPS = [
  15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 100, 120, 140, 160, 180, 200, 240, 300, 360, 420, 480, 600, 720, 900, 1200,
  1800, 2700, 3600,
]
const SECONDS_IN_HOUR = 3600

type SaveState =
  | { kind: 'idle' | 'saving' | 'saved' | 'failed' }
  | { kind: 'changed' | 'limited'; work: number; pause: number }

const withValues = (steps: number[], ...values: number[]) =>
  [...new Set([...steps, ...values])].sort((a, b) => a - b)

function HourStrip({ work, pause }: { work: number; pause: number }) {
  const cycle = work + pause
  const count = cycle > 0 ? Math.ceil(SECONDS_IN_HOUR / cycle) : 0
  return (
    <figure className="hour">
      <svg viewBox={`0 0 ${SECONDS_IN_HOUR} 100`} preserveAspectRatio="none" role="img" aria-label="Распыления за час">
        <rect className="hour-track" width={SECONDS_IN_HOUR} height="100" />
        {Array.from({ length: count }, (_, index) => (
          <rect key={index} className="hour-spray" x={index * cycle} width={work} height="100" />
        ))}
      </svg>
      <figcaption>
        <span>0</span>
        <span>30 мин</span>
        <span>1 час</span>
      </figcaption>
    </figure>
  )
}

interface StepperProps {
  label: string
  steps: number[]
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

function Stepper({ label, steps, value, disabled, onChange }: StepperProps) {
  return (
    <label className="stepper">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={steps.indexOf(value)}
        disabled={disabled}
        aria-valuetext={duration(value)}
        onChange={(event) => onChange(steps[Number(event.target.value)] ?? value)}
      />
    </label>
  )
}

interface RhythmPanelProps {
  work: number
  pause: number
  active: boolean
  week: DaySchedule[]
  onSave: (work: number, pause: number) => Promise<Rhythm | null>
}

export function RhythmPanel({ work, pause, active, week, onSave }: RhythmPanelProps) {
  const [draftWork, setDraftWork] = useState(work)
  const [draftPause, setDraftPause] = useState(pause)
  const [stored, setStored] = useState({ work, pause })
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  const { presets, addPreset, removePreset } = usePresets()
  const workSteps = useMemo(() => withValues(WORK_STEPS, work, draftWork), [work, draftWork])
  const pauseSteps = useMemo(() => withValues(PAUSE_STEPS, pause, draftPause), [pause, draftPause])
  const chips = useRef<HTMLDivElement>(null)

  if (stored.work !== work || stored.pause !== pause) {
    setStored({ work, pause })
    setDraftWork(work)
    setDraftPause(pause)
    if (save.kind !== 'saving') setSave({ kind: 'idle' })
  }

  const saving = save.kind === 'saving'
  const dirty = draftWork !== work || draftPause !== pause
  const sprays = spraysPerHour(draftWork, draftPause)
  const days = bottleDays(draftWork, draftPause, week)
  const target = fitRhythm(draftWork, draftPause)
  const known = presets.some((preset) => preset.work === target.work && preset.pause === target.pause)

  const pick = (nextWork: number, nextPause: number) => {
    setDraftWork(nextWork)
    setDraftPause(nextPause)
    setSave({ kind: 'idle' })
  }

  const submit = async () => {
    setSave({ kind: 'saving' })
    const result = await onSave(target.work, target.pause)
    if (!result) return setSave({ kind: 'failed' })
    setStored({ work: result.work, pause: result.pause })
    setDraftWork(result.work)
    setDraftPause(result.pause)
    if (result.work !== target.work || result.pause !== target.pause) {
      return setSave({ kind: 'changed', work: result.work, pause: result.pause })
    }
    if (target.work !== draftWork || target.pause !== draftPause) {
      return setSave({ kind: 'limited', work: result.work, pause: result.pause })
    }
    setSave({ kind: 'saved' })
  }

  return (
    <section className="panel rhythm" aria-labelledby="rhythm-title">
      <h2 id="rhythm-title">Ритм</h2>
      <div className="rhythm-values">
        <div>
          <strong>{duration(draftWork)}</strong>
          <span>распыление</span>
        </div>
        <div>
          <strong>{duration(draftPause)}</strong>
          <span>пауза</span>
        </div>
      </div>

      <HourStrip work={draftWork} pause={draftPause} />
      <p className="rhythm-note">
        {sprays} {plural(sprays, 'распыление', 'распыления', 'распылений')} в час
        {days !== null && (
          <>
            , полного флакона хватит примерно на {days} {plural(days, 'день', 'дня', 'дней')}
          </>
        )}
      </p>

      <Stepper
        label="Распыление"
        steps={workSteps}
        value={draftWork}
        disabled={saving}
        onChange={(next) => pick(next, draftPause)}
      />
      <Stepper
        label="Пауза"
        steps={pauseSteps}
        value={draftPause}
        disabled={saving}
        onChange={(next) => pick(draftWork, next)}
      />

      <div ref={chips} tabIndex={-1} className="chips" role="group" aria-label="Готовые ритмы">
        {presets.map((preset) => (
          <Chip
            key={preset.id}
            name={preset.name}
            active={preset.work === draftWork && preset.pause === draftPause}
            disabled={saving}
            onClick={() => pick(preset.work, preset.pause)}
            onRemove={
              preset.custom
                ? () => {
                    removePreset(preset.id)
                    chips.current?.focus()
                  }
                : undefined
            }
          />
        ))}
        {!known && (
          <span className="chip chip-add">
            <button
              onClick={() => {
                addPreset(target.work, target.pause)
                chips.current?.focus()
              }}
            >
              Запомнить этот ритм
            </button>
          </span>
        )}
      </div>

      <div className="save-row">
        <button
          className="button button-main"
          disabled={(!dirty && active) || saving || draftWork <= 0 || draftPause <= 0}
          onClick={() => void submit()}
        >
          {saving ? 'Сохраняю' : 'Сохранить в станцию'}
        </button>
        <p className="save-state" role="status">
          {save.kind === 'saved' && active && 'Станция сохранила ритм'}
          {save.kind === 'failed' && 'Не сохранилось, попробуй ещё раз'}
          {save.kind === 'changed' &&
            `Станция оставила ${duration(save.work)} распыления и ${duration(save.pause)} паузы`}
          {save.kind === 'limited' &&
            `Сохранено ${duration(save.work)} распыления и ${duration(save.pause)} паузы, это предел приложения`}
          {(save.kind === 'idle' || save.kind === 'saved') &&
            !active &&
            'Этот ритм сейчас не включён. Сохрани, чтобы он заработал'}
        </p>
      </div>
    </section>
  )
}
