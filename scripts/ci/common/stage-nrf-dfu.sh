#!/usr/bin/env bash
# Unpack / normalize Nordic DFU artifacts and fallbacks (same logic as custom_build firmware workflow).
#
# Usage: stage-nrf-dfu.sh BUILD_DIR
# BUILD_DIR = absolute path to .pio/build/<env>
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MESH_FORGE_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

BUILD_DIR=${1:?usage: stage-nrf-dfu.sh BUILD_DIR}

bash "$MESH_FORGE_ROOT/scripts/ci/common/stage-nrf52-dfu-from-build.sh" "$BUILD_DIR"

# firmware/ subdirectory fallback (local builds or alternate PIO layouts).
if [ -d "$BUILD_DIR/firmware" ] && ! ls "$BUILD_DIR"/*.dat >/dev/null 2>&1; then
  echo "Found firmware/ subdirectory; staging nRF52 DFU files to build root"
  shopt -s nullglob
  for f in "$BUILD_DIR/firmware/"*.bin "$BUILD_DIR/firmware/"*.dat; do
    [ -f "$f" ] && cp -a "$f" "$BUILD_DIR/"
  done
  shopt -u nullglob
  [ -f "$BUILD_DIR/firmware/manifest.json" ] && cp -a "$BUILD_DIR/firmware/manifest.json" "$BUILD_DIR/"
fi

# firmware.bin present but still no .dat — nRF52 only (never when bootloader.bin exists).
if [ -f "$BUILD_DIR/firmware.bin" ] && \
   ! [ -f "$BUILD_DIR/bootloader.bin" ] && \
   ! ls "$BUILD_DIR"/*.dat >/dev/null 2>&1; then
  echo "firmware.bin found but no .dat (nRF52); generating DFU init packet"
  adafruit-nrfutil dfu genpkg \
    --dev-type 0xFFFF \
    --dev-revision 0xFFFF \
    --application-version 0xFFFFFFFF \
    --sd-req 0xFFFE \
    --application "$BUILD_DIR/firmware.bin" \
    /tmp/nrf52-dfu-ci.zip
  unzip -jo /tmp/nrf52-dfu-ci.zip "*.dat" -d "$BUILD_DIR/"
  rm -f /tmp/nrf52-dfu-ci.zip
  echo "DFU init packet written: $(ls "$BUILD_DIR"/*.dat 2>/dev/null || echo '(none)')"
fi
