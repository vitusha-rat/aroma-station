import { useEffect, useState, type FormEvent } from 'react'
import { BOTTLE_KEY, FULL_BOTTLE_ML, parseBottle, remainingIn, withRate } from '../bottle'
import { NAME_LIMIT, plural } from '../domain'
import { useStored } from '../storage'

const DEFAULT_VOLUME = 20

function forecast(left: number, rate: number) {
  if (rate <= 0) return ''
  const days = Math.floor(left / rate)
  return days === 0 ? ', хватит меньше чем на день' : `, хватит на ${days} ${plural(days, 'день', 'дня', 'дней')}`
}

export function BottlePanel({ rate, live, now }: { rate: number; live: boolean; now: Date }) {
  const [bottle, setBottle] = useStored(BOTTLE_KEY, parseBottle)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const validVolume = volume >= 1 && volume <= FULL_BOTTLE_ML

  useEffect(() => {
    if (live && bottle && bottle.rate !== rate) setBottle(withRate(bottle, rate, Date.now()))
  }, [bottle, live, rate, setBottle])

  const save = (event: FormEvent) => {
    event.preventDefault()
    setBottle({ name: name.trim().slice(0, NAME_LIMIT), volume, used: 0, since: Date.now(), rate })
    setEditing(false)
  }

  const startEditing = () => {
    setName(bottle?.name ?? '')
    setVolume(bottle?.volume ?? DEFAULT_VOLUME)
    setEditing(true)
  }

  if (editing || !bottle) {
    return (
      <section className="panel" aria-labelledby="bottle-title">
        <h2 id="bottle-title">Флакон</h2>
        <form className="bottle-form" onSubmit={save}>
          <label>
            <span>Аромат</span>
            <input
              className="field"
              maxLength={NAME_LIMIT}
              placeholder="Например, Лес после дождя"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Залито, мл</span>
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={1}
              max={FULL_BOTTLE_ML}
              required
              value={volume || ''}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          {!validVolume && (
            <p className="message message-alert" role="alert">
              Укажи объём от 1 до {FULL_BOTTLE_ML} мл.
            </p>
          )}
          <button className="button button-main" disabled={!validVolume}>
            Флакон заполнен
          </button>
          {bottle && (
            <button type="button" className="button button-quiet" onClick={() => setEditing(false)}>
              Отмена
            </button>
          )}
        </form>
      </section>
    )
  }

  const left = remainingIn(bottle, now.getTime())
  const share = Math.min(left / bottle.volume, 1)

  return (
    <section className="panel" aria-labelledby="bottle-title">
      <div className="row-switch">
        <h2 id="bottle-title">Флакон{bottle.name ? `: ${bottle.name}` : ''}</h2>
        <button className="link-button" onClick={startEditing}>
          Новый флакон
        </button>
      </div>
      <div className="bottle-meter" role="img" aria-label={`Осталось примерно ${Math.round(left)} мл`}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
      <p className="rhythm-note">
        {left < 1
          ? 'По расчёту аромат закончился, проверь флакон'
          : `Осталось примерно ${Math.round(left)} из ${bottle.volume} мл${forecast(left, rate)}`}
      </p>
    </section>
  )
}
