import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeReport, encode } from './protocol.ts'

const hex = (text: string) => Uint8Array.from(text.split(' ').map((byte) => parseInt(byte, 16)))
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')

test('reads a status report captured from a real V900', () => {
  assert.deepEqual(decodeReport(hex('a6 0d 01 00 01 00 00 00 2c 9a 1f ff 00 19 64 00 00 3b 00 51')), {
    kind: 'status',
    status: {
      power: true,
      mode: 6,
      timerOn: false,
      timerHours: 1,
      battery: 25,
      light: { on: false, motion: true, brightness: 3, r: 0x9a, g: 0x1f, b: 0xff },
    },
  })
})

test('reads rhythm and day reports captured from a real V900', () => {
  assert.deepEqual(decodeReport(hex('a7 00 0f 00 b4 00 00 00 00 00 01 00 00 00 00 6b')), {
    kind: 'rhythm',
    rhythm: { on: true, work: 15, pause: 180 },
  })
  assert.deepEqual(decodeReport(hex('a8 01 01 0c 00 0e 3b 00 00 ff')), {
    kind: 'day',
    day: { week: 1, open: true, startHour: 12, startMinute: 0, endHour: 14, endMinute: 59 },
  })
})

test('rejects corrupted and truncated reports', () => {
  assert.equal(decodeReport(hex('a7 00 0f 00 b5 00 00 00 00 00 01 00 00 00 00 6b')), null)
  assert.equal(decodeReport(hex('a8 01 01 0c')), null)
  assert.equal(decodeReport(hex('ff 00')), null)
})

test('builds commands byte for byte', () => {
  assert.equal(toHex(encode.query()), 'a5 08 03 00 00 b0')
  assert.equal(toHex(encode.session(true)), 'a5 09 02 01 b1')
  assert.equal(toHex(encode.rhythm({ on: true, work: 15, pause: 300 })), 'a5 07 09 01 00 0f 01 2c 00 00 00 f2')
  assert.equal(
    toHex(
      encode.days([
        { week: 1, open: true, startHour: 12, startMinute: 0, endHour: 14, endMinute: 59 },
        { week: 2, open: false, startHour: 12, startMinute: 0, endHour: 15, endMinute: 0 },
      ]),
    ),
    'a5 05 07 01 01 0c 00 0e 3b 08 a5 05 07 02 00 0c 00 0f 00 ce',
  )
})
