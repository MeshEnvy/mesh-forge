#!/usr/bin/env bash
# End-to-end local smoke for flashable gzip tarballs (same layout as CI → R2):
#   1) pio run -e <heltec> -e <rak> per vendored project (test/fw-pio-smoke-envs.json)
#   2) Per env: test/test-pio-fw-staging-local.sh → common/fw-bundle-pipeline.sh (MESHTASTIC_OTA=0; CI uses 1)
# Meshtastic OTA download/extend is skipped locally (set MESHTASTIC_OTA=1 to match Actions exactly).
#
# Requires: jq, platformio, bash
# Usage (from mesh-forge repo root):
#   ./scripts/ci/test/run-fw-pio-smoke-local.sh [path/to/fw-pio-smoke-envs.json]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MESH_FORGE_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
CONFIG_JSON=${1:-"$SCRIPT_DIR/fw-pio-smoke-envs.json"}

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to read $CONFIG_JSON" >&2
  exit 1
fi

if [ ! -f "$CONFIG_JSON" ]; then
  echo "Config not found: $CONFIG_JSON" >&2
  exit 1
fi

# Same helper as CI for LittleFS-heavy Meshtastic-family builds.
MKLITTLEFS_BIN=$(find "${HOME}/.platformio/packages" -type f -name mklittlefs 2>/dev/null | head -1)
if [ -n "${MKLITTLEFS_BIN:-}" ]; then
  export PATH
  PATH="$(dirname "$MKLITTLEFS_BIN"):$PATH"
fi
command -v mklittlefs >/dev/null 2>&1 || echo "WARNING: mklittlefs not on PATH; some envs may fail to build" >&2

echo "== MeshForge firmware smoke: full PIO build + flashable .tar.gz verification =="
echo "MESH_FORGE_ROOT=$MESH_FORGE_ROOT"
echo "CONFIG_JSON=$CONFIG_JSON"
echo ""

N=$(jq '.projects | length' "$CONFIG_JSON")
i=0
while [ "$i" -lt "$N" ]; do
  rel=$(jq -r --argjson idx "$i" '.projects[$idx].path' "$CONFIG_JSON")
  heltec=$(jq -r --argjson idx "$i" '.projects[$idx].heltec_v3' "$CONFIG_JSON")
  rak=$(jq -r --argjson idx "$i" '.projects[$idx].rak_4631' "$CONFIG_JSON")
  i=$((i + 1))

  proj="$MESH_FORGE_ROOT/$rel"
  if [ ! -f "$proj/platformio.ini" ]; then
    echo "SKIP (no platformio.ini): $rel" >&2
    continue
  fi

  echo "-------------------------------------------------------------------"
  echo "[$i/$N] PROJECT $rel — phase: PlatformIO compile"
  echo "  pio run -e $heltec -e $rak"
  echo "-------------------------------------------------------------------"
  (cd "$proj" && pio run -e "$heltec" -e "$rak")

  for env in "$heltec" "$rak"; do
    build_dir="$proj/.pio/build/$env"
    if [ ! -d "$build_dir" ]; then
      echo "Missing build dir: $build_dir" >&2
      exit 1
    fi
    echo ""
    echo "--- Phase: CI package + gzip tarball verify (R2-shaped artifact): $rel / $env ---"
    bash "$MESH_FORGE_ROOT/scripts/ci/test/test-pio-fw-staging-local.sh" "$build_dir"
    echo ""
  done
done

echo "OK: end-to-end smoke finished — every env built with PIO and passed flashable .tar.gz checks."
