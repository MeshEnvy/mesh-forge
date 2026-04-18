#!/usr/bin/env bash
# Copy flashable artifacts from a PIO build dir into STAGE and add bundle docs (CI package step).
#
# Usage: package-firmware-to-stage.sh FIRMWARE_ROOT BUILD_DIR STAGE_DIR
#   FIRMWARE_ROOT = PlatformIO project root
#   BUILD_DIR     = absolute path to .pio/build/<env>
#   STAGE_DIR     = output directory (caller creates/clears as needed)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MESH_FORGE_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

FIRMWARE_ROOT=${1:?usage: package-firmware-to-stage.sh FIRMWARE_ROOT BUILD_DIR STAGE_DIR}
BUILD_DIR=${2:?usage: package-firmware-to-stage.sh FIRMWARE_ROOT BUILD_DIR STAGE_DIR}
STAGE_DIR=${3:?usage: package-firmware-to-stage.sh FIRMWARE_ROOT BUILD_DIR STAGE_DIR}

mkdir -p "$STAGE_DIR"

shopt -s nullglob
if [ -f "$BUILD_DIR/bootloader.bin" ]; then
  if [ -f "$BUILD_DIR/firmware-merged.factory.bin" ]; then
    cp -a "$BUILD_DIR/firmware-merged.factory.bin" "$STAGE_DIR/"
  else
    fz=( "$BUILD_DIR"/*.factory.bin )
    if [ "${#fz[@]}" -gt 0 ]; then
      for f in "${fz[@]}"; do cp -a "$f" "$STAGE_DIR/"; done
    else
      bash "$MESH_FORGE_ROOT/scripts/ci/common/copy-esp32-app-bin-for-bundle.sh" "$BUILD_DIR" "$STAGE_DIR"
    fi
  fi
else
  for f in "$BUILD_DIR"/firmware.bin "$BUILD_DIR"/firmware.dat \
           "$BUILD_DIR"/*.uf2 "$BUILD_DIR"/*.hex; do
    [ -f "$f" ] && cp -a "$f" "$STAGE_DIR/"
  done
  [ -f "$BUILD_DIR/manifest.json" ] && cp -a "$BUILD_DIR/manifest.json" "$STAGE_DIR/"
fi
shopt -u nullglob

bash "$MESH_FORGE_ROOT/scripts/ci/common/stage-fw-bundle-docs.sh" "$FIRMWARE_ROOT" "$STAGE_DIR"

if [ -z "$(find "$STAGE_DIR" -mindepth 1 -maxdepth 1 -type f -print -quit)" ]; then
  echo "No firmware artifacts found in $BUILD_DIR" >&2
  exit 1
fi
