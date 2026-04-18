#!/usr/bin/env bash
# After `pio run -t mergebin`, PlatformIO may write any *.factory.bin name (often tied to
# PROGNAME). Downstream steps expect a single merged image at firmware-merged.factory.bin.
#
# Usage: normalize-esp32-merged-factory.sh BUILD_DIR
set -euo pipefail

BUILD_DIR="${1:?usage: normalize-esp32-merged-factory.sh BUILD_DIR}"

if [ ! -f "$BUILD_DIR/bootloader.bin" ]; then
  exit 0
fi

TARGET="$BUILD_DIR/firmware-merged.factory.bin"
if [ -f "$TARGET" ]; then
  echo "ESP32 merged factory already present: $TARGET"
  exit 0
fi

shopt -s nullglob
candidates=( "$BUILD_DIR"/*.factory.bin )
shopt -u nullglob

if [ "${#candidates[@]}" -eq 0 ]; then
  echo "No *.factory.bin in $BUILD_DIR (mergebin may have failed or not apply to this env)"
  exit 0
fi

pick_merged() {
  local best="" f b
  for f in "${candidates[@]}"; do
    b=$(basename "$f" | tr '[:upper:]' '[:lower:]')
    if [[ "$b" == *merged* ]]; then
      echo "$f"
      return 0
    fi
  done
  local largest="" maxz=-1 z
  for f in "${candidates[@]}"; do
    z=$(wc -c <"$f" | tr -d ' ')
    if [ "$z" -gt "$maxz" ]; then
      maxz=$z
      largest=$f
    fi
  done
  echo "$largest"
}

chosen="$(pick_merged)"
if [ -z "$chosen" ] || [ ! -f "$chosen" ]; then
  echo "Could not pick a merged factory binary"
  exit 0
fi

cp -a "$chosen" "$TARGET"
echo "ESP32 merged factory normalized: $(basename "$chosen") -> $(basename "$TARGET")"
