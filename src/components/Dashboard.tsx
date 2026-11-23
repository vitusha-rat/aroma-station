import { useEffect, useState, type ReactNode } from 'react'
import { mlPerDay } from '../bottle'
import { runState } from '../domain'
import { CUSTOM_MODE } from '../station/protocol'
import { planOf, type Station, type StationData } from '../station/useStation'
import { useStorageIssue } from '../storage'
import { BackupControls } from './BackupControls'
import { BottlePanel } from './BottlePanel'
import { LightPanel } from './LightPanel'
import { RhythmPanel } from './RhythmPanel'
import { ScenesPanel } from './ScenesPanel'
import { Switch } from './Switch'
import { TimerPanel } from './TimerPanel'
import { WeekPanel } from './WeekPanel'

const LOW_BATTERY = 15
const MINUTE_MS = 60_000

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), MINUTE_MS - (now.getTime() % MINUTE_MS))
    return () => window.clearTimeout(timer)
  }, [now])
  return now
}

function Battery({ level }: { level: number }) {
  return (
    <span className={level <= LOW_BATTERY ? 'battery battery-low' : 'battery'} aria-label={`Заряд ${level}%`}>
      <span className="battery-case" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(level, 100) / 100})` }} />
      </span>
      {level}%
    </span>
  )
}

function LinkBanner({ station }: { station: Station }) {
  const connecting = station.phase === 'connecting'
  return (
    <div className="link-banner" role="status">
      <p>{connecting ? 'Подключаюсь к станции' : 'Связь со станцией потеряна'}</p>
      {!connecting && (
        <button className="button button-main" onClick={() => void station.reconnect()}>
          Подключиться снова
        </button>
      )}
    </div>
  )
}

function StationPart({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return (
    <div className={enabled ? 'station-part' : 'station-part bench-off'} inert={!enabled}>
      {children}
    </div>
  )
}

export function Dashboard({ station, data }: { station: Station; data: StationData }) {
  const now = useNow()
  const { status, rhythm, week } = data
  const live = station.phase === 'ready'
  const editable = live && status.power
  const run = runState(status.power, week, now)
  const plan = planOf(data)
  const rhythmActive = rhythm.on && status.mode === CUSTOM_MODE
  const running = status.power && rhythmActive
  const rate = running ? mlPerDay(rhythm.work, rhythm.pause, week) : 0
  const storageIssue = useStorageIssue()

  return (
    <div className="desk">
      <header className="masthead">
        <div className="masthead-title">
          <h1>ZAUM V900</h1>
          <p className={run.running ? 'run run-active' : 'run'}>{run.label}</p>
        </div>
        <Battery level={status.battery} />
        <div inert={!live}>
          <Switch large label="Питание станции" checked={status.power} onChange={(on) => void station.setPower(on)} />
        </div>
      </header>

      {!live && <LinkBanner station={station} />}
      {(station.error ?? station.notice) && (
        <p className="message message-alert" role="alert">
          {station.error ?? station.notice}
        </p>
      )}

      {storageIssue && (
        <p className="message message-alert" role="alert">
          Браузер не сохранил данные на этом устройстве. Сохрани копию настроек в файл.
        </p>
      )}

      <main className="bench">
        <ScenesPanel
          current={plan}
          running={running}
          editable={editable}
          busy={station.busy}
          onApply={station.applyPlan}
        />
        <div className="bench-side">
          <StationPart enabled={editable}>
            <RhythmPanel
              work={rhythm.work}
              pause={rhythm.pause}
              active={rhythmActive}
              week={week}
              onSave={station.saveRhythm}
            />
          </StationPart>
          <BottlePanel rate={rate} live={live} now={now} />
        </div>
        <div className="bench-side">
          <StationPart enabled={editable}>
            <WeekPanel week={week} now={now} onSave={station.saveDays} />
          </StationPart>
          <StationPart enabled={editable}>
            <LightPanel light={status.light} onChange={station.setLight} />
          </StationPart>
          <StationPart enabled={editable}>
            <TimerPanel on={status.timerOn} hours={status.timerHours} onChange={station.setTimer} />
          </StationPart>
          <BackupControls
            current={plan}
            rhythmActive={rhythmActive}
            editable={editable}
            busy={station.busy}
            onApply={station.applyPlan}
          />
        </div>
      </main>

      {station.phase !== 'connecting' && (
        <footer className="desk-foot">
          <button className="button button-quiet" onClick={() => void station.disconnect()}>
            Отключиться от станции
          </button>
        </footer>
      )}
    </div>
  )
}
