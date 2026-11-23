import type { Station } from '../station/useStation'

const APK_URL = 'https://github.com/vitusha-rat/aroma-station/releases/latest/download/aroma-station.apk'

function Column() {
  return (
    <svg className="column" viewBox="0 0 120 220" aria-hidden="true">
      <path className="column-mist" d="M60 34c-14-8-10-18 0-24 10 6 14 16 0 24Z" />
      <path className="column-funnel" d="M26 42h68L68 62H52L26 42Z" />
      <rect className="column-body" x="44" y="62" width="32" height="148" rx="3" />
      <rect className="column-light" x="44" y="62" width="9" height="148" rx="3" />
    </svg>
  )
}

function AndroidDownload() {
  const offered = /Android/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches
  return offered ? (
    <a className="gate-download" href={APK_URL}>
      Скачать приложение для Android
    </a>
  ) : null
}

export function Connect({ station }: { station: Station }) {
  const connecting = station.phase === 'connecting'
  return (
    <main className="gate">
      <Column />
      <h1>Подключи аромастанцию</h1>
      <ol className="gate-steps">
        <li>Удержи кнопку с солнцем 3 секунды, пока индикатор не станет фиолетовым.</li>
        <li>Закрой Fragrant Pro на телефоне: станция держит только одно подключение.</li>
      </ol>
      {station.error && (
        <p className="message message-alert" role="alert">
          {station.error}
        </p>
      )}
      <button className="button button-main" disabled={connecting} onClick={() => void station.connect()}>
        {connecting ? 'Подключаюсь' : 'Подключить станцию'}
      </button>
      <AndroidDownload />
    </main>
  )
}

export function Unsupported() {
  return (
    <main className="gate">
      <Column />
      <h1>Этот браузер не умеет работать с Bluetooth</h1>
      <ul className="gate-steps">
        <li>На Mac и Android открой страницу в Chrome.</li>
        <li>
          На iPhone открой её в бесплатном браузере{' '}
          <a href="https://apps.apple.com/ru/app/bluefy-web-ble-browser/id1492822055">Bluefy</a>.
        </li>
      </ul>
      <AndroidDownload />
    </main>
  )
}
