"""
mf_protocol.py — MeshForge sideload via meshtastic-python XModem.

Uses Node.uploadFile() from the meshtastic Python library (vendored at
vendor/meshtastic-python) for all file transfers.

Requires: pip install pyserial  (meshtastic is loaded from the vendor submodule)
"""

import glob as globmod
import os
import re
import sys
import time


# ── Resolve the vendored meshtastic-python library ────────────────────────────
# Walk up from this file to find the mesh-forge repo root, then add the
# vendored library to sys.path.

def _find_vendor_meshtastic():
    here = os.path.dirname(os.path.abspath(__file__))
    # tools/ → meshforge-sideload/ → mesh-forge root
    candidate = os.path.normpath(os.path.join(here, '..', '..', 'vendor', 'meshtastic-python'))
    if os.path.isdir(os.path.join(candidate, 'meshtastic')):
        return candidate
    return None

_vendor_path = _find_vendor_meshtastic()
if _vendor_path and _vendor_path not in sys.path:
    sys.path.insert(0, _vendor_path)


# ── meshforge.yaml parser ─────────────────────────────────────────────────────

def parse_data_entries(yaml_text: str) -> list:
    """Return list of (glob_pattern, device_dest) from meshforge.yaml data: section."""
    entries = []
    in_mf = in_data = False
    for raw in yaml_text.splitlines():
        line = re.sub(r'#.*$', '', raw).rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        content = line.strip()
        if indent == 0:
            in_mf = (content == 'meshforge:')
            in_data = False
        elif in_mf and indent == 2:
            in_data = (content == 'data:')
        elif in_mf and in_data and indent == 4:
            m = re.match(r'^-\s+(.+)$', content)
            if m:
                entry = m.group(1).strip().strip('"\'')
                colon = entry.find(':')
                if colon > 0:
                    entries.append((entry[:colon].strip(), entry[colon + 1:].strip()))
    return entries


# ── Autodetect port ───────────────────────────────────────────────────────────

def autodetect_port():
    try:
        import serial.tools.list_ports
        KNOWN = ['RAK', 'nRF52', 'Adafruit', 'Nordic', 'Meshtastic', 'WisMesh',
                 'T-Echo', 'CP210', 'CH340', 'FTDI', 'USB Serial', 'JTAG',
                 'LilyGO', 'Espressif']
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
        import meshtastic.serial_interface
    except ImportError:
        print('ERROR: meshtastic library not found.\n'
              'Install with: pip install meshtastic\n'
              'Or ensure vendor/meshtastic-python is in sys.path')
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
        print('meshforge-sideload: no files matched — nothing to sideload')
        return

    print(f'meshforge-sideload: waiting {boot_wait_s}s for device to boot...')
    time.sleep(boot_wait_s)

    print(f'meshforge-sideload: connecting to {port_name}...')
    iface = meshtastic.serial_interface.SerialInterface(port_name)

    try:
        for i, (src, device_path) in enumerate(transfers):
            size_kb = os.path.getsize(src) / 1024
            name = os.path.basename(src)
            print(f'  [{i + 1}/{len(transfers)}] {name} ({size_kb:.1f} KB) → {device_path}')

            def progress(sent, total, _name=name):
                pct = 100 * sent // total
                bar = '#' * (pct // 5) + '.' * (20 - pct // 5)
                print(f'\r    [{bar}] {pct}%', end='', flush=True)

            ok = iface.localNode.uploadFile(src, device_path, on_progress=progress)
            if ok:
                print(f'\r    [{"#" * 20}] 100% done')
            else:
                print(f'\r    FAILED')
                raise RuntimeError(f'Upload failed: {src} → {device_path}')
    finally:
        iface.close()

    print(f'meshforge-sideload: {len(transfers)} file(s) uploaded successfully')
