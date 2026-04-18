#!/usr/bin/env bash
# Local parity with CI firmware bundle: runs common/fw-bundle-pipeline.sh (no Meshtastic OTA).
# Same mergebin → normalize → DFU stage → package → tar → verify path as Actions.
#
# Usage (from repo root):
#   ./scripts/ci/test/test-pio-fw-staging-local.sh /path/to/.pio/build/ENV
set -euo pipefail

MESH_FORGE_ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
BUILD_DIR_INPUT=${1:?usage: $0 /path/to/.pio/build/ENV}

if [ ! -d "$BUILD_DIR_INPUT" ]; then
  echo "Not a directory: $BUILD_DIR_INPUT" >&2
  exit 1
fi

BUILD_DIR=$(cd "$BUILD_DIR_INPUT" && pwd)
FIRMWARE_ROOT=$(cd "$BUILD_DIR/../../.." && pwd)
PIO_ENV=$(basename "$BUILD_DIR")

TAR_LOCAL=/tmp/fw-bundle-local-test.tar.gz

echo "== MeshForge local firmware bundle (fw-bundle-pipeline.sh, no OTA) =="
echo "FIRMWARE_ROOT=$FIRMWARE_ROOT"
echo "BUILD_DIR=$BUILD_DIR"
echo "PIO_ENV=$PIO_ENV"
echo ""

FW_BUNDLE_VERBOSE=1 MESHTASTIC_OTA=0 bash "$MESH_FORGE_ROOT/scripts/ci/common/fw-bundle-pipeline.sh" \
  "$FIRMWARE_ROOT" "$BUILD_DIR" "$TAR_LOCAL"

echo ""
echo "--- Tarball listing ---"
tar -tzf "$TAR_LOCAL"
rm -f "$TAR_LOCAL"

echo ""
echo "OK: fw-bundle-pipeline.sh produced a verified tarball (same core path as CI)."
