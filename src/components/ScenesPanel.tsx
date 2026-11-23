import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NAME_LIMIT } from '../domain'
import {
  AWAY_KEY,
  BUILT_IN_SCENES,
  builtInPlan,
  hasOpenDays,
  openDaysOf,
  parseAwayDays,
  parseScenes,
  SCENES_KEY,
} from '../scenes'
import { fitRhythm, sameEffect, type StationPlan } from '../station/plan'
import { useStored } from '../storage'
import { Chip } from './Chip'

interface ScenesPanelProps {
  current: StationPlan
  running: boolean
  editable: boolean
  busy: boolean
  onApply: (plan: StationPlan, writeRhythm: boolean) => Promise<boolean>
}

export function ScenesPanel({ current, running, editable, busy, onApply }: ScenesPanelProps) {
  const [custom, setCustom] = useStored(SCENES_KEY, parseScenes)
  const [awayDays, setAwayDays] = useStored(AWAY_KEY, parseAwayDays)
  const [applying, setApplying] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (awayDays && !busy && hasOpenDays(current.week)) setAwayDays(null)
  }, [awayDays, busy, current.week, setAwayDays])

  const scenes = [
    ...BUILT_IN_SCENES.map((scene) => {
      const plan = builtInPlan(scene, current, awayDays)
      const fits = scene.away ? true : running && hasOpenDays(plan.week)
      return { id: scene.id, name: scene.name, plan, away: scene.away === true, custom: false, fits }
    }),
    ...custom.map((scene) => ({ ...scene, away: false, custom: true, fits: running })),
  ]

  const apply = async (scene: (typeof scenes)[number]) => {
    setApplying(scene.id)
    if (scene.away && hasOpenDays(current.week)) setAwayDays(openDaysOf(current.week))
    await onApply(scene.plan, !scene.away)
    setApplying(null)
  }

  const closeForm = () => {
    setName('')
    setNaming(false)
    addButton.current?.focus()
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const plan = { ...current, ...fitRhythm(current.work, current.pause) }
    setCustom([...custom, { id: `${Date.now()}`, name: trimmed.slice(0, NAME_LIMIT), plan }])
    closeForm()
  }

  const remove = (id: string) => {
    setCustom(custom.filter((item) => item.id !== id))
    addButton.current?.focus()
  }

  return (
    <section className={editable ? 'panel scenes' : 'panel scenes scenes-off'} aria-labelledby="scenes-title">
      <h2 id="scenes-title">Сценарии</h2>
      <div className="chips" role="group" aria-labelledby="scenes-title">
        {scenes.map((scene) => (
          <Chip
            key={scene.id}
            name={scene.name}
            label={applying === scene.id ? 'Применяю' : scene.name}
            active={scene.fits && sameEffect(scene.plan, current)}
            disabled={!editable || busy}
            onClick={() => void apply(scene)}
            onRemove={scene.custom ? () => remove(scene.id) : undefined}
          />
        ))}
        <span className="chip chip-add">
          <button ref={addButton} aria-expanded={naming} disabled={busy} onClick={() => setNaming(true)}>
            Запомнить текущие настройки
          </button>
        </span>
      </div>
      {naming && (
        <form className="inline-form" onSubmit={save}>
          <input
            className="field"
            aria-label="Название сценария"
            placeholder="Название сценария"
            maxLength={NAME_LIMIT}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="button button-main" disabled={!name.trim() || busy}>
            Сохранить
          </button>
          <button type="button" className="button button-quiet" onClick={closeForm}>
            Отмена
          </button>
          <p className="editor-hint">Запомнятся настройки, которые сейчас записаны в станции.</p>
        </form>
      )}
    </section>
  )
}
