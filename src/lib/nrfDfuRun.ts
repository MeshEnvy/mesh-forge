/**
 * Nordic Legacy Serial DFU (v0.5) over Web Serial.
 *
 * Protocol ported from meshcore-dev/flasher.meshcore.io/lib/dfu.js, which was itself
 * adapted from Adafruit's adafruit-nrfutil Python implementation.
 *
 * Supported bundle format: Nordic DFU manifest.json + firmware.bin + firmware.dat
 * (same as what PlatformIO produces for MeshCore RAK4631 and similar nRF52 boards).
 */

import { findInTar } from './untarGz'

// ---------------------------------------------------------------------------
// Protocol constants (adapted from dfu/dfu_transport_serial.py)
// ---------------------------------------------------------------------------

const DFU_BAUD = 115200
const READ_TIMEOUT_MS = 5000
const FLASH_PAGE_SIZE = 4096
const FLASH_PAGE_ERASE_TIME_MS = 90 // nRF52840 max ~89.7 ms
const FLASH_WORD_WRITE_TIME_MS = 0.1 // nRF52840 max ~100 µs per word
const FLASH_PAGE_WRITE_TIME_MS = (FLASH_PAGE_SIZE / 4) * FLASH_WORD_WRITE_TIME_MS // ≈ 102 ms
const DFU_PACKET_MAX_SIZE = 512

const DATA_INTEGRITY_CHECK_PRESENT = 1
const RELIABLE_PACKET = 1
const HCI_PACKET_TYPE = 14

const DFU_INIT_PACKET = 1
const DFU_START_PACKET = 3
const DFU_DATA_PACKET = 4
const DFU_STOP_DATA_PACKET = 5
const DFU_ERASE_PAGE = 6
const DFU_UPDATE_MODE_APP = 4

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Nordic DFU manifest.json "application" shape (dfu_version 0.5). */
type NordicManifest = {
  manifest: {
    application: {
      bin_file: string
      dat_file: string
    }
    dfu_version?: number
  }
}

export type NordicDfuPlan = {
  appBin: Uint8Array
  /** Init packet (.dat file) — CRC + metadata for the bootloader. */
  initPacket: Uint8Array
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function int32LE(value: number): Uint8Array {
  const buf = new ArrayBuffer(4)
  new DataView(buf).setUint32(0, value, true)
  return new Uint8Array(buf)
}

function int16LE(value: number): Uint8Array {
  const buf = new ArrayBuffer(2)
  new DataView(buf).setUint16(0, value, true)
  return new Uint8Array(buf)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

// ---------------------------------------------------------------------------
// CRC16 (adapted from dfu/crc16.py)
// ---------------------------------------------------------------------------

function calcCrc16(data: Uint8Array, crc = 0xffff): number {
  for (let i = 0; i < data.length; i++) {
    crc = ((crc >> 8) & 0x00ff) | ((crc << 8) & 0xff00)
    crc ^= data[i]
    crc ^= (crc & 0x00ff) >> 4
    crc ^= (crc << 8) << 4
    crc ^= ((crc & 0x00ff) << 4) << 1
  }
  return crc & 0xffff
}

// ---------------------------------------------------------------------------
// SLIP framing
// ---------------------------------------------------------------------------

function slipPartsToFourBytes(seq: number, dip: number, rp: number, pktType: number, pktLen: number): Uint8Array {
  const b = new Uint8Array(4)
  b[0] = seq | (((seq + 1) % 8) << 3) | (dip << 6) | (rp << 7)
  b[1] = pktType | ((pktLen & 0x000f) << 4)
  b[2] = (pktLen & 0x0ff0) >> 4
  b[3] = (~(b[0] + b[1] + b[2]) + 1) & 0xff
  return b
}

function slipEncodeEscChars(data: Uint8Array): Uint8Array {
  const result: number[] = []
  for (const byte of data) {
    if (byte === 0xc0) {
      result.push(0xdb, 0xdc)
    } else if (byte === 0xdb) {
      result.push(0xdb, 0xdd)
    } else {
      result.push(byte)
    }
  }
  return new Uint8Array(result)
}

function slipDecode(data: number[]): Uint8Array {
  const result: number[] = []
  let i = 0
  while (i < data.length) {
    if (data[i] === 0xdb) {
      i++
      if (i >= data.length) throw new Error('Invalid SLIP escape: truncated')
      result.push(data[i] === 0xdc ? 0xc0 : data[i] === 0xdd ? 0xdb : (() => { throw new Error(`Invalid SLIP escape: 0xDB 0x${data[i].toString(16)}`) })())
    } else if (data[i] !== 0xc0) {
      result.push(data[i])
    }
    i++
  }
  return new Uint8Array(result)
}

// ---------------------------------------------------------------------------
// HCI packet
// ---------------------------------------------------------------------------

let hciSequenceNumber = 0

function makeHciPacket(payload: Uint8Array): Uint8Array {
  hciSequenceNumber = (hciSequenceNumber + 1) % 8
  const header = slipPartsToFourBytes(
    hciSequenceNumber,
    DATA_INTEGRITY_CHECK_PRESENT,
    RELIABLE_PACKET,
    HCI_PACKET_TYPE,
    payload.length
  )
  const withHeader = concat(header, payload)
  const crc = calcCrc16(withHeader)
  const withCrc = concat(withHeader, new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]))
  const encoded = slipEncodeEscChars(withCrc)
  return concat(new Uint8Array([0xc0]), encoded, new Uint8Array([0xc0]))
}

// ---------------------------------------------------------------------------
// Serial I/O helpers
// ---------------------------------------------------------------------------

async function writeRaw(port: SerialPort, data: Uint8Array): Promise<void> {
  const writer = port.writable!.getWriter()
  try {
    await writer.write(data)
  } finally {
    writer.releaseLock()
  }
}

/**
 * Read until two 0xC0 SLIP delimiters are received.
 * Returns the decoded payload between the delimiters.
 */
async function readAck(port: SerialPort): Promise<Uint8Array> {
  const reader = port.readable!.getReader()
  const buf: number[] = []
  let c0Count = 0

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DFU ACK timeout')), READ_TIMEOUT_MS)
  )

  try {
    await Promise.race([
      (async () => {
        while (c0Count < 2) {
          const { value, done } = await reader.read()
          if (done) throw new Error('Port closed before ACK')
          if (value) {
            for (const b of value) {
              buf.push(b)
              if (b === 0xc0) c0Count++
            }
          }
        }
      })(),
      timeout,
    ])
  } finally {
    reader.releaseLock()
  }

  const first = buf.indexOf(0xc0)
  const second = buf.indexOf(0xc0, first + 1)
  if (first === -1 || second === -1) throw new Error('Incomplete ACK frame')
  return slipDecode(buf.slice(first + 1, second))
}

let lastAck = -1

async function sendPacket(port: SerialPort, payload: Uint8Array): Promise<void> {
  const pkt = makeHciPacket(payload)
  await writeRaw(port, pkt)

  const decoded = await readAck(port)
  if (decoded.length < 2) throw new Error('ACK too short')
  const ack = (decoded[0] >> 3) & 0x07
  if (lastAck !== -1 && ack !== (lastAck + 1) % 8) {
    hciSequenceNumber = 0
    throw new Error(`ACK sequence mismatch: expected ${(lastAck + 1) % 8}, got ${ack}`)
  }
  lastAck = ack
}

// ---------------------------------------------------------------------------
// DFU commands
// ---------------------------------------------------------------------------

async function sendStartDfu(port: SerialPort, appSize: number): Promise<void> {
  const payload = concat(
    int32LE(DFU_START_PACKET),
    int32LE(DFU_UPDATE_MODE_APP),
    int32LE(0), // softdevice size
    int32LE(0), // bootloader size
    int32LE(appSize)
  )
  await sendPacket(port, payload)
  // Wait for flash erase proportional to app size
  const eraseMs = Math.max(500, (Math.ceil(appSize / FLASH_PAGE_SIZE) + 1) * FLASH_PAGE_ERASE_TIME_MS)
  await sleepMs(eraseMs)
}

async function sendInitPacket(port: SerialPort, dat: Uint8Array): Promise<void> {
  const payload = concat(int32LE(DFU_INIT_PACKET), dat, int16LE(0x0000))
  await sendPacket(port, payload)
}

async function sendErasePage(port: SerialPort, pageAddress: number): Promise<void> {
  const payload = concat(int32LE(DFU_ERASE_PAGE), int32LE(pageAddress))
  await sendPacket(port, payload)
  await sleepMs(FLASH_PAGE_ERASE_TIME_MS)
}

async function eraseFullFlash(port: SerialPort, appSize: number): Promise<void> {
  const numPages = Math.ceil(appSize / FLASH_PAGE_SIZE)
  for (let i = 0; i < numPages; i++) {
    await sendErasePage(port, i * FLASH_PAGE_SIZE)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect a Nordic DFU bundle in the tarball map.
 *
 * Path 1: Nordic DFU manifest.json (from MeshCore PIO output or adafruit-nrfutil zip).
 *   Looks for manifest.json with { manifest: { application: { bin_file, dat_file } } }.
 *
 * Path 2: Bare firmware.dat + firmware.bin without a Nordic manifest.json.
 *   CI generates firmware.dat via adafruit-nrfutil for nRF52 builds; both files land
 *   in the bundle alongside the .uf2. Detected by presence of any *.dat file.
 */
export function buildNordicDfuPlan(files: Map<string, Uint8Array>): NordicDfuPlan | null {
  // Path 1: Nordic DFU manifest.json
  const manifestRaw = findInTar(files, 'manifest.json')
  if (manifestRaw) {
    try {
      const m = JSON.parse(new TextDecoder().decode(manifestRaw)) as NordicManifest
      const app = m?.manifest?.application
      if (app?.bin_file && app?.dat_file) {
        const appBin = findInTar(files, app.bin_file)
        const initPacket = findInTar(files, app.dat_file)
        if (appBin && initPacket) return { appBin, initPacket }
      }
    } catch { /* fall through to Path 2 */ }
  }

  // Path 2: Bare .dat + .bin (CI-generated; no Nordic manifest needed)
  let initPacket: Uint8Array | undefined
  let datBaseName: string | undefined
  for (const [path, data] of files) {
    const base = path.replace(/^.*\//, '')
    if (base.toLowerCase().endsWith('.dat')) {
      initPacket = data
      datBaseName = base.replace(/\.dat$/i, '')
      break
    }
  }
  if (!initPacket || !datBaseName) return null

  // Prefer matching base name (firmware.dat → firmware.bin), fall back to any firmware.bin
  const appBin = findInTar(files, `${datBaseName}.bin`) ?? findInTar(files, 'firmware.bin')
  if (!appBin) return null

  return { appBin, initPacket }
}

/**
 * Run a Nordic Legacy Serial DFU update.
 * The port should already be closed (after the 1200-baud CDC touch);
 * this function opens it at 115200 and handles teardown.
 */
export async function runNordicDfu(options: {
  port: SerialPort
  plan: NordicDfuPlan
  eraseAll?: boolean
  onPhase: (label: string) => void
  onProgress: (pct: number) => void
}): Promise<void> {
  const { port, plan, eraseAll = false, onPhase, onProgress } = options

  // Reset HCI state for this session
  hciSequenceNumber = 0
  lastAck = -1

  onPhase('Connecting to bootloader…')
  await port.open({ baudRate: DFU_BAUD })

  try {
    if (eraseAll) {
      onPhase('Erasing flash…')
      await eraseFullFlash(port, plan.appBin.length)
    }

    onPhase('Sending DFU start…')
    await sendStartDfu(port, plan.appBin.length)

    onPhase('Sending init packet…')
    await sendInitPacket(port, plan.initPacket)

    onPhase('Writing firmware…')
    const chunks: Uint8Array[] = []
    for (let i = 0; i < plan.appBin.length; i += DFU_PACKET_MAX_SIZE) {
      chunks.push(plan.appBin.subarray(i, i + DFU_PACKET_MAX_SIZE))
    }

    let bytesSent = 0
    // Brief stabilization pause before the first data packet (mirrors Python implementation)
    await sleepMs(FLASH_PAGE_WRITE_TIME_MS)

    for (let i = 0; i < chunks.length; i++) {
      const payload = concat(int32LE(DFU_DATA_PACKET), chunks[i])
      await sendPacket(port, payload)
      bytesSent += chunks[i].length
      onProgress(Math.min(100, Math.round((bytesSent / plan.appBin.length) * 100)))

      // Yield after every 8 packets (one flash page) to let the bootloader catch up
      if ((i + 1) % 8 === 0) {
        await sleepMs(FLASH_PAGE_WRITE_TIME_MS)
      }
    }

    // Final page write wait + stop
    await sleepMs(FLASH_PAGE_WRITE_TIME_MS)
    await sendPacket(port, int32LE(DFU_STOP_DATA_PACKET))
  } finally {
    // Clean up streams before closing
    try {
      if (port.readable) {
        const r = port.readable.getReader()
        await r.cancel().catch(() => {})
        r.releaseLock()
      }
    } catch { /* ignore */ }
    try {
      if (port.writable) {
        const w = port.writable.getWriter()
        await w.close().catch(() => {})
        w.releaseLock()
      }
    } catch { /* ignore */ }
    try { await port.close() } catch { /* ignore */ }
  }
}
