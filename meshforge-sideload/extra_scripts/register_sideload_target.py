"""
register_sideload_target.py — PlatformIO extra_script that registers the
`sideload` custom target for the meshforge-sideload library.

Transfers data files declared in meshforge.yaml to the device using
Node.uploadFile() from the meshtastic Python library.

Usage:
    pio run -t sideload
    pio run -t upload -t sideload
    pio run -t sideload --upload-port /dev/cu.usbmodem101
    MESHFORGE_PORT=/dev/cu.usbmodemXXXX pio run -t sideload
    MESHFORGE_BOOT_WAIT=5 pio run -t sideload
"""

Import('env')  # noqa: F821

import os
import sys
import time


def _ensure_vendor_meshtastic():
    """Add vendor/meshtastic-python to sys.path so we can import it."""
    project_dir = env.subst('$PROJECT_DIR')  # noqa: F821
    # firmware/ → TinyBBS/ → vendor/ → mesh-forge root
    candidate = os.path.normpath(os.path.join(project_dir, '..', '..', '..', 'vendor', 'meshtastic-python'))
    if os.path.isdir(os.path.join(candidate, 'meshtastic')) and candidate not in sys.path:
        sys.path.insert(0, candidate)
    # Also add tools/ dir of meshforge-sideload for mf_protocol
    libdeps = env.subst('$PROJECT_LIBDEPS_DIR')  # noqa: F821
    pioenv  = env.subst('$PIOENV')               # noqa: F821
    tools_dir = os.path.join(libdeps, pioenv, 'meshforge-sideload', 'tools')
    if os.path.isdir(tools_dir) and tools_dir not in sys.path:
        sys.path.insert(0, tools_dir)


def _autodetect_port():
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


def _sideload(source, target, env):  # noqa: F821
    _ensure_vendor_meshtastic()

    try:
        from mf_protocol import run_sideload
    except ImportError as e:
        print(f'meshforge-sideload: ERROR importing mf_protocol: {e}')
        raise SystemExit(1)

    project_dir = env['PROJECT_DIR']  # noqa: F821
    port_name = (
        env.get('UPLOAD_PORT')
        or os.environ.get('MESHFORGE_PORT')
        or _autodetect_port()
    )
    if not port_name:
        print(
            'meshforge-sideload: ERROR — no serial port found.\n'
            '  Pass one: pio run -t sideload --upload-port /dev/cu.usbmodemXXXX\n'
            '  Or set:   MESHFORGE_PORT=/dev/cu.usbmodemXXXX pio run -t sideload'
        )
        raise SystemExit(1)

    boot_wait = float(os.environ.get('MESHFORGE_BOOT_WAIT', '3'))
    baud      = int(env.get('MONITOR_SPEED', 115200))

    run_sideload(
        project_dir=project_dir,
        port_name=port_name,
        baud=baud,
        boot_wait_s=boot_wait,
    )


env.AddCustomTarget(  # noqa: F821
    name='sideload',
    dependencies=None,
    actions=_sideload,
    title='MeshForge Sideload',
    description='Upload meshforge.yaml data files to device via Meshtastic XModem',
)
