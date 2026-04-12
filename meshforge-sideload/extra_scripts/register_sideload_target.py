"""
register_sideload_target.py — PlatformIO extra_script that registers the
`sideload` custom target for the meshforge-sideload library.

Transfers data files to the device via Meshtastic StreamAPI + XModem, using
the /ext/ and /int/ path prefix convention supported by the xmodem-ext-fs patch.

Usage:
    pio run -t sideload
    pio run -t upload -t sideload
    pio run -t sideload --upload-port /dev/cu.usbmodem101
    MESHFORGE_PORT=/dev/cu.usbmodemXXXX pio run -t sideload
    MESHFORGE_BOOT_WAIT=5 pio run -t sideload
"""

Import('env')  # noqa: F821 — PlatformIO SCons environment

import glob as globmod
import os
import re
import struct
import sys
import time

# ── Meshtastic StreamAPI + XModem protocol (inline) ──────────────────────────

XC_SOH = 1; XC_STX = 2; XC_EOT = 4; XC_ACK = 6; XC_NAK = 21; XC_CAN = 24
XMODEM_BUF = 128; MAX_RETRY = 10; ACK_TIMEOUT = 5.0


def _varint(n):
    out = []
    while n > 0x7F: out.append((n & 0x7F) | 0x80); n >>= 7
    out.append(n); return bytes(out)


def _pb_bytes(field, data):
    tag = _varint((field << 3) | 2)
    return tag + _varint(len(data)) + data


def _encode_xm(control, seq, crc16, buf):
    msg = _varint((1 << 3) | 0) + _varint(control)
    if seq:   msg += _varint((2 << 3) | 0) + _varint(seq)
    if crc16: msg += _varint((3 << 3) | 0) + _varint(crc16)
    if buf:   msg += _pb_bytes(4, buf)
    return msg


def _to_radio(xm): return _pb_bytes(5, xm)
def _frame(payload): return b'\x94\xc3' + struct.pack('>H', len(payload)) + payload


def _crc16(data):
    crc = 0
    for b in data:
        crc = ((crc >> 8) | (crc << 8)) & 0xFFFF; crc ^= b
        crc ^= ((crc & 0xFF) >> 4) & 0xFFFF
        crc ^= ((crc << 8) << 4) & 0xFFFF
        crc ^= (((crc & 0xFF) << 4) << 1) & 0xFFFF
    return crc & 0xFFFF


def _read_varint(data, pos):
    val = shift = 0
    while pos < len(data):
        b = data[pos]; pos += 1; val |= (b & 0x7F) << shift; shift += 7
        if not (b & 0x80): break
    return val, pos


def _parse_xm(data):
    i, r = 0, {'control': 0, 'seq': 0, 'crc16': 0, 'buffer': b''}
    while i < len(data):
        tag = data[i]; i += 1; fn, wt = tag >> 3, tag & 0x7
        if wt == 0:
            val, i = _read_varint(data, i)
            if fn == 1: r['control'] = val
            elif fn == 2: r['seq'] = val
            elif fn == 3: r['crc16'] = val
        elif wt == 2:
            l, i = _read_varint(data, i)
            if fn == 4: r['buffer'] = data[i:i+l]
            i += l
        else: break
    return r


def _parse_from_radio(data):
    i = 0
    while i < len(data):
        tag = data[i]; i += 1; fn, wt = tag >> 3, tag & 0x7
        if wt == 0: _, i = _read_varint(data, i)
        elif wt == 2:
            l, i = _read_varint(data, i); payload = data[i:i+l]; i += l
            if fn == 12: return _parse_xm(payload)
        else: break
    return None


def _read_xm_resp(port, timeout_s=ACK_TIMEOUT):
    buf = bytearray(); deadline = time.time() + timeout_s
    while time.time() < deadline:
        n = port.in_waiting
        if n: buf += port.read(n)
        for i in range(len(buf) - 1):
            if buf[i] == 0x94 and buf[i+1] == 0xC3 and len(buf) >= i + 4:
                length = (buf[i+2] << 8) | buf[i+3]
                if len(buf) >= i + 4 + length:
                    payload = bytes(buf[i+4:i+4+length]); del buf[:i+4+length]
                    xm = _parse_from_radio(payload)
                    if xm: return xm
                    break
        time.sleep(0.01)
    return None


def _send_file(port, dest, data, on_progress=None):
    # SOH — filename
    fn = dest.encode('ascii')
    for attempt in range(MAX_RETRY):
        port.write(_frame(_to_radio(_encode_xm(XC_SOH, 0, 0, fn))))
        r = _read_xm_resp(port)
        if r and r['control'] == XC_ACK: break
        if attempt == MAX_RETRY - 1: raise IOError(f'XModem OPEN rejected: {dest}')
    # STX data
    seq = 1; off = 0
    while off < len(data):
        chunk = data[off:off+XMODEM_BUF]; crc = _crc16(chunk); acked = False
        for retry in range(MAX_RETRY):
            port.write(_frame(_to_radio(_encode_xm(XC_STX, seq, crc, chunk))))
            r = _read_xm_resp(port)
            if r and r['control'] == XC_ACK: acked = True; break
            if r and r['control'] == XC_CAN: raise IOError(f'Transfer cancelled at {off}')
        if not acked: raise IOError(f'No ACK for seq {seq} at offset {off}')
        off += len(chunk); seq = (seq & 0xFF) + 1
        if on_progress: on_progress(off, len(data))
    # EOT
    for attempt in range(MAX_RETRY):
        port.write(_frame(_to_radio(_encode_xm(XC_EOT, 0, 0, b''))))
        r = _read_xm_resp(port)
        if r and r['control'] == XC_ACK: return
        if attempt == MAX_RETRY - 1: raise IOError(f'EOT not acked: {dest}')


def _parse_data_entries(yaml_text):
    entries = []; in_mf = in_data = False
    for raw in yaml_text.splitlines():
        line = re.sub(r'#.*$', '', raw).rstrip()
        if not line.strip(): continue
        indent = len(line) - len(line.lstrip()); content = line.strip()
        if indent == 0: in_mf = (content == 'meshforge:'); in_data = False
        elif in_mf and indent == 2: in_data = (content == 'data:')
        elif in_mf and in_data and indent == 4:
            m = re.match(r'^-\s+(.+)$', content)
            if m:
                entry = m.group(1).strip().strip('"\''); colon = entry.find(':')
                if colon > 0: entries.append((entry[:colon].strip(), entry[colon+1:].strip()))
    return entries


def _autodetect_port():
    try:
        import serial.tools.list_ports
        KNOWN = ['RAK', 'nRF52', 'Adafruit', 'Nordic', 'Meshtastic', 'WisMesh',
                 'T-Echo', 'CP210', 'CH340', 'FTDI', 'USB Serial', 'JTAG', 'LilyGO', 'Espressif']
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            desc = (p.description or '') + ' ' + (p.manufacturer or '')
            if any(k.lower() in desc.lower() for k in KNOWN): return p.device
        for p in ports:
            if 'usbmodem' in p.device or 'usbserial' in p.device: return p.device
    except ImportError: pass
    return None


# ── PlatformIO target action ──────────────────────────────────────────────────

def _sideload(source, target, env):  # noqa: F821
    try:
        import serial
    except ImportError:
        print('meshforge-sideload: ERROR — pyserial not installed. Run: pip install pyserial')
        raise SystemExit(1)

    project_dir = env['PROJECT_DIR']  # noqa: F821
    yaml_path = os.path.join(project_dir, 'meshforge.yaml')
    if not os.path.isfile(yaml_path):
        print('meshforge-sideload: no meshforge.yaml — nothing to sideload'); return

    with open(yaml_path, encoding='utf-8') as f:
        entries = _parse_data_entries(f.read())
    if not entries:
        print('meshforge-sideload: no data: entries — nothing to sideload'); return

    transfers = []
    for glob_pat, dest in entries:
        for src in sorted(globmod.glob(os.path.join(project_dir, glob_pat), recursive=True)):
            if os.path.isfile(src):
                transfers.append((src, dest.rstrip('/') + '/' + os.path.basename(src)))
    if not transfers:
        print('meshforge-sideload: no files matched — nothing to sideload'); return

    port_name = env.get('UPLOAD_PORT') or os.environ.get('MESHFORGE_PORT') or _autodetect_port()
    if not port_name:
        print('meshforge-sideload: ERROR — no serial port found.\n'
              '  Pass one: pio run -t sideload --upload-port /dev/cu.usbmodemXXXX')
        raise SystemExit(1)

    boot_wait = float(os.environ.get('MESHFORGE_BOOT_WAIT', '3'))
    baud = int(env.get('MONITOR_SPEED', 115200))

    print(f'meshforge-sideload: waiting {boot_wait}s for device to boot...')
    time.sleep(boot_wait)
    print(f'meshforge-sideload: connecting to {port_name} @ {baud}...')

    with serial.Serial(port_name, baud, timeout=ACK_TIMEOUT) as port:
        time.sleep(0.5)
        for i, (src, device_path) in enumerate(transfers):
            data = open(src, 'rb').read()
            name = os.path.basename(src)
            print(f'  [{i+1}/{len(transfers)}] {name} ({len(data)/1024:.1f} KB) → {device_path}')
            def progress(sent, total, _name=name):
                pct = 100 * sent // total
                bar = '#' * (pct // 5) + '.' * (20 - pct // 5)
                print(f'\r    [{bar}] {pct}%', end='', flush=True)
            _send_file(port, device_path, data, on_progress=progress)
            print(f'\r    [{"#"*20}] 100% done')

    print(f'meshforge-sideload: {len(transfers)} file(s) uploaded successfully')


env.AddCustomTarget(  # noqa: F821
    name='sideload',
    dependencies=None,
    actions=_sideload,
    title='MeshForge Sideload',
    description='Upload meshforge.yaml data files via Meshtastic StreamAPI + XModem',
)
