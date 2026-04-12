"""
mf_protocol.py — Meshtastic StreamAPI + XModem file transfer (Python host side).

Matches the patched xmodem.cpp on the firmware side.

Meshtastic StreamAPI framing:
  0x94 0xC3  <len:2 BE>  <protobuf payload>

ToRadio.xmodemPacket  = field 5
FromRadio.xmodemPacket = field 12

meshtastic_XModem fields:
  control (1, varint)  — XModem Control enum
  seq     (2, varint)  — packet sequence
  crc16   (3, varint)  — CRC-16-CCITT of buffer
  buffer  (4, bytes)   — up to 128 bytes
"""

import glob as globmod
import os
import re
import struct
import sys
import time

# XModem Control enum values
XC_NUL   = 0
XC_SOH   = 1
XC_STX   = 2
XC_EOT   = 4
XC_ACK   = 6
XC_NAK   = 21
XC_CAN   = 24

XMODEM_BUFFER_SIZE = 128
MAX_RETRIES        = 10
ACK_TIMEOUT_S      = 5.0


# ── CRC-16-CCITT ──────────────────────────────────────────────────────────────

def crc16_ccitt(data: bytes) -> int:
    crc = 0
    for b in data:
        crc = ((crc >> 8) | (crc << 8)) & 0xFFFF
        crc ^= b
        crc ^= ((crc & 0xFF) >> 4) & 0xFFFF
        crc ^= ((crc << 8) << 4) & 0xFFFF
        crc ^= (((crc & 0xFF) << 4) << 1) & 0xFFFF
    return crc & 0xFFFF


# ── Minimal protobuf encoding ─────────────────────────────────────────────────

def varint(n: int) -> bytes:
    out = []
    while n > 0x7F:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    out.append(n)
    return bytes(out)


def pb_bytes_field(field: int, data: bytes) -> bytes:
    tag = varint((field << 3) | 2)
    return tag + varint(len(data)) + data


def encode_xmodem(control: int, seq: int, crc16: int, buffer: bytes) -> bytes:
    msg = varint((1 << 3) | 0) + varint(control)
    if seq:   msg += varint((2 << 3) | 0) + varint(seq)
    if crc16: msg += varint((3 << 3) | 0) + varint(crc16)
    if buffer: msg += pb_bytes_field(4, buffer)
    return msg


def encode_toradio(xmodem_bytes: bytes) -> bytes:
    return pb_bytes_field(5, xmodem_bytes)


def stream_frame(payload: bytes) -> bytes:
    return b'\x94\xc3' + struct.pack('>H', len(payload)) + payload


# ── FromRadio response parsing ────────────────────────────────────────────────

def _parse_varint(data: bytes, pos: int):
    val, shift = 0, 0
    while pos < len(data):
        b = data[pos]; pos += 1
        val |= (b & 0x7F) << shift; shift += 7
        if not (b & 0x80): break
    return val, pos


def parse_xmodem(data: bytes) -> dict:
    i, result = 0, {'control': 0, 'seq': 0, 'crc16': 0, 'buffer': b''}
    while i < len(data):
        tag = data[i]; i += 1
        fn, wt = tag >> 3, tag & 0x7
        if wt == 0:
            val, i = _parse_varint(data, i)
            if fn == 1: result['control'] = val
            elif fn == 2: result['seq'] = val
            elif fn == 3: result['crc16'] = val
        elif wt == 2:
            l, i = _parse_varint(data, i)
            if fn == 4: result['buffer'] = data[i:i+l]
            i += l
        else: break
    return result


def parse_from_radio(data: bytes) -> dict | None:
    i = 0
    while i < len(data):
        tag = data[i]; i += 1
        fn, wt = tag >> 3, tag & 0x7
        if wt == 0:
            _, i = _parse_varint(data, i)
        elif wt == 2:
            l, i = _parse_varint(data, i)
            payload = data[i:i+l]; i += l
            if fn == 12:
                return parse_xmodem(payload)
        else: break
    return None


# ── StreamAPI frame reader ────────────────────────────────────────────────────

def read_xmodem_response(port, timeout_s: float = ACK_TIMEOUT_S) -> dict | None:
    buf = bytearray()
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        n = port.in_waiting
        if n: buf += port.read(n)
        # Scan for 0x94 0xC3 frame
        start = -1
        for i in range(len(buf) - 1):
            if buf[i] == 0x94 and buf[i+1] == 0xC3:
                start = i; break
        if start >= 0 and len(buf) >= start + 4:
            length = (buf[start+2] << 8) | buf[start+3]
            if len(buf) >= start + 4 + length:
                payload = bytes(buf[start+4:start+4+length])
                del buf[:start+4+length]
                xm = parse_from_radio(payload)
                if xm: return xm
                # Not an XModem frame — keep reading
                continue
        time.sleep(0.01)
    return None


# ── File transfer ─────────────────────────────────────────────────────────────

def send_xmodem_file(port, dest_path: str, data: bytes,
                     on_progress=None) -> None:
    # SOH seq=0 — filename handshake
    fn_bytes = dest_path.encode('ascii')
    for attempt in range(MAX_RETRIES):
        port.write(stream_frame(encode_toradio(encode_xmodem(XC_SOH, 0, 0, fn_bytes))))
        resp = read_xmodem_response(port)
        if resp and resp['control'] == XC_ACK:
            break
        if attempt == MAX_RETRIES - 1:
            raise IOError(f'XModem OPEN rejected for {dest_path}')

    # STX data packets
    seq = 1
    offset = 0
    while offset < len(data):
        chunk = data[offset:offset + XMODEM_BUFFER_SIZE]
        crc = crc16_ccitt(chunk)
        acked = False
        for retry in range(MAX_RETRIES):
            port.write(stream_frame(encode_toradio(encode_xmodem(XC_STX, seq, crc, chunk))))
            resp = read_xmodem_response(port)
            if resp and resp['control'] == XC_ACK:
                acked = True; break
            if resp and resp['control'] == XC_CAN:
                raise IOError(f'XModem transfer cancelled at offset {offset}')
        if not acked:
            raise IOError(f'XModem: no ACK for seq {seq} at offset {offset}')
        offset += len(chunk)
        seq = (seq & 0xFF) + 1
        if on_progress: on_progress(offset, len(data))

    # EOT
    for attempt in range(MAX_RETRIES):
        port.write(stream_frame(encode_toradio(encode_xmodem(XC_EOT, 0, 0, b''))))
        resp = read_xmodem_response(port)
        if resp and resp['control'] == XC_ACK:
            return
        if attempt == MAX_RETRIES - 1:
            raise IOError(f'XModem EOT not acknowledged for {dest_path}')


# ── meshforge.yaml parser (minimal) ──────────────────────────────────────────

def parse_data_entries(yaml_text: str) -> list:
    entries = []
    in_mf = in_data = False
    for raw in yaml_text.splitlines():
        line = re.sub(r'#.*$', '', raw).rstrip()
        if not line.strip(): continue
        indent = len(line) - len(line.lstrip())
        content = line.strip()
        if indent == 0:
            in_mf = (content == 'meshforge:'); in_data = False
        elif in_mf and indent == 2:
            in_data = (content == 'data:')
        elif in_mf and in_data and indent == 4:
            m = re.match(r'^-\s+(.+)$', content)
            if m:
                entry = m.group(1).strip().strip('"\'')
                colon = entry.find(':')
                if colon > 0:
                    entries.append((entry[:colon].strip(), entry[colon+1:].strip()))
    return entries


# ── Autodetect port ───────────────────────────────────────────────────────────

def autodetect_port():
    try:
        import serial.tools.list_ports
        KNOWN = ['RAK', 'nRF52', 'Adafruit', 'Nordic', 'Meshtastic',
                 'WisMesh', 'T-Echo', 'CP210', 'CH340', 'FTDI', 'USB Serial',
                 'JTAG', 'LilyGO', 'Espressif']
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            desc = (p.description or '') + ' ' + (p.manufacturer or '')
            if any(k.lower() in desc.lower() for k in KNOWN):
                return p.device
        for p in ports:
            if 'usbmodem' in p.device or 'usbserial' in p.device:
                return p.device
    except ImportError:
        pass
    return None


# ── Main sideload routine ─────────────────────────────────────────────────────

def run_sideload(project_dir: str, port_name: str, baud: int = 115200,
                 boot_wait_s: float = 3.0) -> None:
    try:
        import serial
    except ImportError:
        print('ERROR: pyserial not installed. Run: pip install pyserial')
        sys.exit(1)

    yaml_path = os.path.join(project_dir, 'meshforge.yaml')
    if not os.path.isfile(yaml_path):
        print('meshforge-sideload: no meshforge.yaml — nothing to sideload')
        return

    with open(yaml_path, encoding='utf-8') as f:
        entries = parse_data_entries(f.read())

    if not entries:
        print('meshforge-sideload: no data: entries — nothing to sideload')
        return

    transfers = []
    for glob_pat, dest in entries:
        for src in sorted(globmod.glob(os.path.join(project_dir, glob_pat), recursive=True)):
            if os.path.isfile(src):
                transfers.append((src, dest.rstrip('/') + '/' + os.path.basename(src)))

    if not transfers:
        print('meshforge-sideload: no files matched globs — nothing to sideload')
        return

    print(f'meshforge-sideload: waiting {boot_wait_s}s for device to boot...')
    time.sleep(boot_wait_s)

    print(f'meshforge-sideload: connecting to {port_name} @ {baud}...')
    with serial.Serial(port_name, baud, timeout=ACK_TIMEOUT_S) as port:
        time.sleep(0.5)
        for i, (src, device_path) in enumerate(transfers):
            data = open(src, 'rb').read()
            name = os.path.basename(src)
            print(f'  [{i+1}/{len(transfers)}] {name} ({len(data)/1024:.1f} KB) → {device_path}')

            def progress(sent, total, _name=name):
                pct = 100 * sent // total
                bar = '#' * (pct // 5) + '.' * (20 - pct // 5)
                print(f'\r    [{bar}] {pct}%', end='', flush=True)

            send_xmodem_file(port, device_path, data, on_progress=progress)
            print(f'\r    [{"#"*20}] 100% done')

    print(f'meshforge-sideload: {len(transfers)} file(s) uploaded successfully')
