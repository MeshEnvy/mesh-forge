"""
apply_patches.py — PlatformIO pre: extra_script.

Applies the MeshForge Meshtastic patches to the firmware source tree in order:

  01-nrf-external-flash.patch  — extFSInit hook, extFS pointer, extfs-nrf52.cpp
  02-xmodem-vfs-routing.patch  — FSRoute, fsRoute(), XModem /__ext__/ routing

Each patch is skipped if its sentinel string is already present (idempotent).
Safe to run on every build.

Add to your firmware's platformio.ini:

    extra_scripts =
        pre:path/to/apply_patches.py
"""

Import('env')  # noqa: F821

import os
import subprocess
import sys

_PATCHES = [
    ('01-nrf-external-flash.patch', 'extFSInit'),   # sentinel unique to patch 1
    ('02-xmodem-vfs-routing.patch', 'fsRoute'),     # sentinel unique to patch 2
]

_PATCH_DIR = os.path.dirname(os.path.abspath(__file__))


def _project_dir():
    return env.subst('$PROJECT_DIR')  # noqa: F821


def _sentinel_present(sentinel: str) -> bool:
    """Return True if the sentinel string already exists in the source tree."""
    for dirpath, _, filenames in os.walk(os.path.join(_project_dir(), 'src')):
        for fname in filenames:
            if not (fname.endswith('.h') or fname.endswith('.cpp')):
                continue
            try:
                with open(os.path.join(dirpath, fname), encoding='utf-8', errors='replace') as f:
                    if sentinel in f.read():
                        return True
            except OSError:
                pass
    return False


def _apply(patch_file: str) -> None:
    patch_path = os.path.join(_PATCH_DIR, patch_file)
    if not os.path.isfile(patch_path):
        print(f'[meshforge-patches] WARNING: {patch_file} not found')
        return

    # Dry-run first
    check = subprocess.run(
        ['git', 'apply', '--check', '--whitespace=nowarn', patch_path],
        cwd=_project_dir(),
        capture_output=True,
    )
    if check.returncode != 0:
        print(f'[meshforge-patches] WARNING: {patch_file} cannot apply cleanly — skipping '
              f'(already applied or conflict)')
        return

    result = subprocess.run(
        ['git', 'apply', '--whitespace=nowarn', patch_path],
        cwd=_project_dir(),
        capture_output=True,
    )
    if result.returncode == 0:
        print(f'[meshforge-patches] Applied {patch_file}')
    else:
        print(f'[meshforge-patches] ERROR applying {patch_file}:\n{result.stderr.decode()}')
        sys.exit(1)


for patch_file, sentinel in _PATCHES:
    if _sentinel_present(sentinel):
        print(f'[meshforge-patches] {patch_file} already applied — skipping')
    else:
        print(f'[meshforge-patches] Applying {patch_file}...')
        _apply(patch_file)
