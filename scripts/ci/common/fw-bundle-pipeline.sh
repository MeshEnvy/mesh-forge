#!/usr/bin/env bash
# Single pipeline: PlatformIO build dir → staged artifacts → gzip tarball → verify tarball.
# Used by GitHub Actions (with Meshtastic OTA) and local smoke (without OTA). Do not duplicate
# these steps in workflows — call this script only.
#
# Env:
#   MESHTASTIC_OTA   Set to 1 for CI (download OTA companion + extend merged bin when applicable).
#                    Omit or 0 for local parity tests (skip download/extend).
#   FW_BUNDLE_VERBOSE Set to 1 to print ls of stage dir before tarring (local UX).
#
# Usage: fw-bundle-pipeline.sh FIRMWARE_ROOT BUILD_DIR_ABS OUTPUT_TAR_GZ
#   FIRMWARE_ROOT   = PlatformIO project root (platformio.ini directory)
#   BUILD_DIR_ABS   = absolute path to .pio/build/<env>
#   OUTPUT_TAR_GZ   = path to write the verified .tar.gz (parent dir must exist)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MESH_FORGE_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)

FIRMWARE_ROOT=${1:?usage: fw-bundle-pipeline.sh FIRMWARE_ROOT BUILD_DIR_ABS OUTPUT_TAR_GZ}
BUILD_DIR_ABS=${2:?usage: fw-bundle-pipeline.sh FIRMWARE_ROOT BUILD_DIR_ABS OUTPUT_TAR_GZ}
OUTPUT_TAR_GZ=${3:?usage: fw-bundle-pipeline.sh FIRMWARE_ROOT BUILD_DIR_ABS OUTPUT_TAR_GZ}

MESHTASTIC_OTA=${MESHTASTIC_OTA:-0}
FW_BUNDLE_VERBOSE=${FW_BUNDLE_VERBOSE:-0}

if [ ! -d "$FIRMWARE_ROOT" ] || [ ! -d "$BUILD_DIR_ABS" ]; then
  echo "FIRMWARE_ROOT or BUILD_DIR_ABS is not a directory" >&2
  exit 1
fi

PIO_ENV=$(basename "$BUILD_DIR_ABS")

echo "== fw-bundle-pipeline: FIRMWARE_ROOT=$FIRMWARE_ROOT PIO_ENV=$PIO_ENV OUTPUT=$OUTPUT_TAR_GZ MESHTASTIC_OTA=$MESHTASTIC_OTA =="

bash "$MESH_FORGE_ROOT/scripts/ci/common/mergebin-esp32.sh" "$FIRMWARE_ROOT" "$PIO_ENV"
bash "$MESH_FORGE_ROOT/scripts/ci/common/normalize-esp32-merged-factory.sh" "$BUILD_DIR_ABS"

if [ "$MESHTASTIC_OTA" = 1 ]; then
  bash "$MESH_FORGE_ROOT/scripts/ci/common/download-meshtastic-ota.sh" "$BUILD_DIR_ABS"
  bash "$MESH_FORGE_ROOT/scripts/ci/common/extend-meshtastic-merged-if-present.sh" "$BUILD_DIR_ABS"
else
  echo "(Skipping Meshtastic OTA download/extend — set MESHTASTIC_OTA=1 for CI parity)"
fi

bash "$MESH_FORGE_ROOT/scripts/ci/common/stage-nrf-dfu.sh" "$BUILD_DIR_ABS"

STAGE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fw-bundle-stage.XXXXXX")
cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

bash "$MESH_FORGE_ROOT/scripts/ci/common/package-firmware-to-stage.sh" "$FIRMWARE_ROOT" "$BUILD_DIR_ABS" "$STAGE_DIR"

if [ "$FW_BUNDLE_VERBOSE" = 1 ]; then
  echo ""
  echo "--- Staged files (tarball root) ---"
  ls -la "$STAGE_DIR"
  echo ""
fi

tar -czf "$OUTPUT_TAR_GZ" -C "$STAGE_DIR" .
bash "$MESH_FORGE_ROOT/scripts/ci/common/verify-fw-bundle-stage.sh" "$BUILD_DIR_ABS" "$OUTPUT_TAR_GZ"

echo "fw-bundle-pipeline: OK -> $OUTPUT_TAR_GZ"
