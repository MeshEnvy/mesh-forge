#!/usr/bin/env python3
"""
Extend a PlatformIO-merged ESP32 factory binary with the Meshtastic OTA
companion binary at the ota_1 partition offset.

Reads the ota_1 offset from the partition table binary, pads the merged
binary to that offset with 0xFF, and writes the OTA binary in-place.

Usage: extend-merged-with-ota.py MERGED_BIN PARTITIONS_BIN OTA_BIN
"""
from __future__ import annotations

import struct
import sys


def find_ota1_offset(parts_data: bytes) -> int | None:
    """Parse ESP partition table binary to find the ota_1 partition offset."""
    MAGIC = 0xAA50
    APP_TYPE = 0x00
    OTA1_SUBTYPE = 0x11
    for i in range(0, len(parts_data) - 31, 32):
        magic, ptype, subtype = struct.unpack_from('<HBB', parts_data, i)
        if magic == MAGIC and ptype == APP_TYPE and subtype == OTA1_SUBTYPE:
            return struct.unpack_from('<I', parts_data, i + 4)[0]
    return None


def main() -> int:
    if len(sys.argv) != 4:
        print(
            'usage: extend-merged-with-ota.py MERGED_BIN PARTITIONS_BIN OTA_BIN',
            file=sys.stderr,
        )
        return 2

    merged_path, parts_path, ota_path = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(parts_path, 'rb') as f:
        parts_data = f.read()

    ota1_offset = find_ota1_offset(parts_data)
    if ota1_offset is None:
        print('No ota_1 partition found in partition table; skipping OTA extension')
        return 0

    with open(merged_path, 'rb') as f:
        merged = bytearray(f.read())
    with open(ota_path, 'rb') as f:
        ota = f.read()

    if len(merged) > ota1_offset:
        print(
            f'WARNING: merged binary ({len(merged)} bytes) already extends past '
            f'ota_1 offset (0x{ota1_offset:x}); overwriting',
            file=sys.stderr,
        )
    elif len(merged) < ota1_offset:
        merged += b'\xff' * (ota1_offset - len(merged))

    merged[ota1_offset:ota1_offset + len(ota)] = ota

    with open(merged_path, 'wb') as f:
        f.write(merged)

    print(
        f'Extended {merged_path}: OTA companion ({len(ota)} bytes) at 0x{ota1_offset:x}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
