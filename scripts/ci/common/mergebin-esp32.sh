#!/usr/bin/env bash
# Run PlatformIO mergebin only when the env exposes that target (avoids CI noise when absent).
#
# Usage: mergebin-esp32.sh FIRMWARE_ROOT PIO_ENV_NAME
# FIRMWARE_ROOT = PlatformIO project root (where platformio.ini lives).
set -euo pipefail

FIRMWARE_ROOT=${1:?usage: mergebin-esp32.sh FIRMWARE_ROOT PIO_ENV}
PIO_ENV=${2:?usage: mergebin-esp32.sh FIRMWARE_ROOT PIO_ENV}

BUILD_DIR="$FIRMWARE_ROOT/.pio/build/$PIO_ENV"

if [ ! -f "$BUILD_DIR/bootloader.bin" ]; then
  echo "No bootloader.bin in $BUILD_DIR; skipping mergebin (non-ESP32 target)"
  exit 0
fi

echo "ESP32 target detected ($PIO_ENV)"
cd "$FIRMWARE_ROOT"

if pio run -e "$PIO_ENV" --list-targets 2>/dev/null | grep -qw mergebin; then
  echo "Running mergebin -> firmware-merged.factory.bin"
  export MERGED_BIN_PATH="$BUILD_DIR/firmware-merged.factory.bin"
  pio run -t mergebin -e "$PIO_ENV" 2>&1 || \
    echo "WARNING: mergebin failed; merged factory may be missing"
else
  echo "No mergebin target for $PIO_ENV; skipping (packaging uses app .bin or *.factory.bin if present)"
fi
