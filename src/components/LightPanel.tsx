import { useEffect, useRef } from 'react'
import { MAX_BRIGHTNESS } from '../station/plan'
import type { LightState } from '../station/protocol'
import { Switch } from './Switch'

const COLORS = [
  { name: 'Лаймовый', value: [0xff, 0xff, 0x5d], display: '#b0ff9d' },
  { name: 'Коралловый', value: [0xff, 0x3e, 0x2b], display: '#ffa9a6' },
  { name: 'Фиолетовый', value: [0x9a, 0x1f, 0xff], display: '#9a1fff' },
  { name: 'Синий', value: [0x22, 0x1a, 0xff], display: '#221aff' },
  { name: 'Голубой', value: [0x3c, 0xb2, 0xff], display: '#3cb2ff' },
  { name: 'Холодный белый', value: [0xcc, 0xed, 0xfe], display: '#ccedfe' },
  { name: 'Бирюзовый', value: [0x3a, 0xff, 0xec], display: '#3affec' },
  { name: 'Зелёный', value: [0x89, 0xff, 0x6c], display: '#00ff9d' },
] as const

const LEVELS = Array.from({ length: MAX_BRIGHTNESS + 1 }, (_, level) => level)
const toHex = ({ r, g, b }: Pick<LightState, 'r' | 'g' | 'b'>) =>
  `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`
const isColor = (light: LightState, [r, g, b]: readonly number[]) => light.r === r && light.g === g && light.b === b

function fromHex(value: string) {
  const number = parseInt(value.slice(1), 16)
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }
}

interface LightPanelProps {
  light: LightState
  onChange: (patch: Partial<LightState>) => Promise<boolean>
}

export function LightPanel({ light, onChange }: LightPanelProps) {
  const picker = useRef<HTMLInputElement>(null)
  const latestChange = useRef(onChange)
  const hex = toHex(light)

  useEffect(() => {
    latestChange.current = onChange
  })

  useEffect(() => {
    if (picker.current) picker.current.value = hex
  }, [hex])

  useEffect(() => {
    const input = picker.current
    if (!input) return
    const commit = () => void latestChange.current({ on: true, ...fromHex(input.value) })
    input.addEventListener('change', commit)
    return () => input.removeEventListener('change', commit)
  }, [])

  const isPreset = COLORS.some(({ value }) => isColor(light, value))

  return (
    <section className="panel" aria-labelledby="light-title">
      <div className="row-switch">
        <h2 id="light-title">Подсветка</h2>
        <Switch labelledBy="light-title" checked={light.on} onChange={(on) => void onChange({ on })} />
      </div>
      <div className="swatches" role="group" aria-label="Цвет подсветки">
        {COLORS.map((color) => {
          const [r, g, b] = color.value
          const active = isColor(light, color.value)
          return (
            <button
              key={color.name}
              className={active ? 'swatch swatch-active' : 'swatch'}
              style={{ background: color.display }}
              aria-label={color.name}
              aria-pressed={active}
              onClick={() => void onChange({ on: true, r, g, b })}
            />
          )
        })}
      </div>
      <label className={isPreset ? 'color-row' : 'color-row color-row-active'}>
        <span>Свой цвет</span>
        <input ref={picker} type="color" defaultValue={hex} />
      </label>
      <div className="light-level">
        <span id="brightness-title">Яркость</span>
        <div
          className="segments"
          style={{ gridTemplateColumns: `repeat(${LEVELS.length}, 1fr)` }}
          role="radiogroup"
          aria-labelledby="brightness-title"
        >
          {LEVELS.map((level) => (
            <label key={level} className={level === light.brightness ? 'segment segment-active' : 'segment'}>
              <input
                type="radio"
                name="brightness"
                aria-label={`Яркость ${level + 1} из ${LEVELS.length}`}
                checked={level === light.brightness}
                onChange={() => void onChange({ brightness: level })}
              />
              <span>{level + 1}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="row-switch">
        <span id="breathing-title">Дыхание</span>
        <Switch
          labelledBy="breathing-title"
          checked={light.motion}
          onChange={(motion) => void onChange({ motion })}
        />
      </div>
    </section>
  )
}
