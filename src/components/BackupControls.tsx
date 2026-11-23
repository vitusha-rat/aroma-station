import { useState, type ChangeEvent } from 'react'
import { downloadBackup, parseBackup, restoreLocal, type Backup } from '../backup'
import { BOTTLE_KEY, parseBottle } from '../bottle'
import { AWAY_KEY, parseAwayDays, parseScenes, SCENES_KEY } from '../scenes'
import type { StationPlan } from '../station/plan'
import { useStored } from '../storage'
import { usePresets } from './usePresets'

interface BackupControlsProps {
  current: StationPlan
  rhythmActive: boolean
  editable: boolean
  busy: boolean
  onApply: (plan: StationPlan, writeRhythm: boolean) => Promise<boolean>
}

type Message = { text: string; failed: boolean }

export function BackupControls({ current, rhythmActive, editable, busy, onApply }: BackupControlsProps) {
  const { custom } = usePresets()
  const [scenes] = useStored(SCENES_KEY, parseScenes)
  const [bottle] = useStored(BOTTLE_KEY, parseBottle)
  const [awayDays] = useStored(AWAY_KEY, parseAwayDays)
  const [loaded, setLoaded] = useState<Backup | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [restoring, setRestoring] = useState(false)

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setMessage(null)
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      if (backup) setLoaded(backup)
      else setMessage({ text: 'В этом файле нет подходящей копии настроек.', failed: true })
    } catch {
      setMessage({ text: 'Не получилось прочитать файл.', failed: true })
    }
  }

  const restore = async () => {
    if (!loaded) return
    setRestoring(true)
    setMessage(null)
    const applied = await onApply(loaded.station, loaded.rhythmActive)
    setRestoring(false)
    if (!applied) {
      setMessage({ text: 'Станция могла принять только часть настроек. Попробуй ещё раз.', failed: true })
      return
    }
    restoreLocal(loaded)
    setLoaded(null)
    setMessage({ text: 'Настройки восстановлены.', failed: false })
  }

  return (
    <section className="panel" aria-labelledby="backup-title">
      <h2 id="backup-title">Копия настроек</h2>
      <div className="backup-actions">
        <button
          className="button button-plain"
          disabled={busy}
          onClick={() =>
            downloadBackup({ station: current, rhythmActive, awayDays, presets: custom, scenes, bottle })
          }
        >
          Сохранить в файл
        </button>
        <label className="button button-plain file-button">
          Восстановить из файла
          <input type="file" accept="application/json,.json" onChange={(event) => void pickFile(event)} />
        </label>
      </div>
      {loaded && (
        <div className="editor">
          <p>Заменить текущие настройки копией от {new Date(loaded.savedAt).toLocaleDateString('ru-RU')}?</p>
          {!editable && <p className="editor-hint">Для восстановления включи станцию и подключись к ней.</p>}
          <div className="backup-actions">
            <button
              className="button button-main"
              disabled={!editable || busy || restoring}
              onClick={() => void restore()}
            >
              {restoring ? 'Восстанавливаю' : 'Заменить'}
            </button>
            <button className="button button-quiet" disabled={restoring} onClick={() => setLoaded(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.failed ? 'message message-alert' : 'save-state'} role={message.failed ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}
