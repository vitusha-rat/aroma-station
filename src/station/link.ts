import {
  decodeReport,
  encode,
  NOTIFY_UUID,
  SERVICE_UUID,
  STATION_NAMES,
  WRITE_UUID,
  type Report,
} from './protocol'

const CLOCK_INTERVAL_MS = 10_000

interface LinkEvents {
  onReport: (report: Report) => void
  onLost: () => void
}

export class StationLink {
  private readonly events: LinkEvents
  private device: BluetoothDevice | null = null
  private writer: BluetoothRemoteGATTCharacteristic | null = null
  private notifier: BluetoothRemoteGATTCharacteristic | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private clockTimer: number | undefined
  private closing = false

  constructor(events: LinkEvents) {
    this.events = events
  }

  static get supported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  get connected() {
    return this.device?.gatt?.connected === true && this.writer !== null
  }

  async choose() {
    const device = await navigator.bluetooth.requestDevice({
      filters: STATION_NAMES.map((name) => ({ name })),
      optionalServices: [SERVICE_UUID],
    })
    if (this.device && this.device !== device) {
      await this.close()
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    }
    if (this.device !== device) device.addEventListener('gattserverdisconnected', this.handleDisconnect)
    this.device = device
  }

  async open() {
    const gatt = this.device?.gatt
    if (!gatt) throw new Error('Station is not selected')
    this.release()
    this.closing = false
    try {
      const server = await gatt.connect()
      const service = await server.getPrimaryService(SERVICE_UUID)
      this.writer = await service.getCharacteristic(WRITE_UUID)
      this.notifier = await service.getCharacteristic(NOTIFY_UUID)
      this.notifier.addEventListener('characteristicvaluechanged', this.handleValue)
      await this.notifier.startNotifications()
      await this.send(encode.session(true))
      await this.syncClock()
      if (!gatt.connected) throw new Error('Station disconnected')
      this.clockTimer = window.setInterval(() => void this.syncClock().catch(() => undefined), CLOCK_INTERVAL_MS)
    } catch (error) {
      this.closing = true
      this.release()
      gatt.disconnect()
      throw error
    }
  }

  send(packet: Uint8Array<ArrayBuffer>) {
    const write = this.queue.then(() => {
      if (!this.writer) throw new Error('Station is not connected')
      return this.writer.writeValueWithoutResponse(packet)
    })
    this.queue = write.catch(() => undefined)
    return write
  }

  async close() {
    this.closing = true
    await this.send(encode.session(false)).catch(() => undefined)
    await this.notifier?.stopNotifications().catch(() => undefined)
    this.device?.gatt?.disconnect()
    this.release()
  }

  private syncClock() {
    return this.send(encode.clock(new Date()))
  }

  private release() {
    window.clearInterval(this.clockTimer)
    this.clockTimer = undefined
    this.notifier?.removeEventListener('characteristicvaluechanged', this.handleValue)
    this.notifier = null
    this.writer = null
  }

  private readonly handleValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (!value) return
    const report = decodeReport(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    if (report) this.events.onReport(report)
  }

  private readonly handleDisconnect = () => {
    this.release()
    if (!this.closing) this.events.onLost()
  }
}
