#!/usr/bin/env bash
# If merged factory + partition table + a Meshtastic OTA companion bin exist, extend the merged image.
# No-op when inputs are missing (same behavior as custom_build firmware workflow).
#
# Usage: extend-meshtastic-merged-if-present.sh BUILD_DIR
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MESH_FORGE_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

BUILD_DIR=${1:?usage: extend-meshtastic-merged-if-present.sh BUILD_DIR}

MERGED="$BUILD_DIR/firmware-merged.factory.bin"
PARTS="$BUILD_DIR/partitions.bin"
OTA_BIN=""
shopt -s nullglob
for candidate in "$BUILD_DIR"/mt-*.ota.bin "$BUILD_DIR"/bleota-c3.bin; do
  if [ -f "$candidate" ]; then OTA_BIN="$candidate"; break; fi
done
shopt -u nullglob

if [ -f "$MERGED" ] && [ -f "$PARTS" ] && [ -n "$OTA_BIN" ]; then
  python3 "$MESH_FORGE_ROOT/scripts/ci/common/extend-merged-with-ota.py" \
    "$MERGED" "$PARTS" "$OTA_BIN"
else
  echo "Skipping OTA extension (merged=$([ -f "$MERGED" ] && echo yes || echo no), ota=$([ -n "$OTA_BIN" ] && echo yes || echo no))"
fi
