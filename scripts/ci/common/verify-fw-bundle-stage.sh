#!/usr/bin/env bash
# Fail if a firmware bundle (staging directory OR final .tar.gz/.tgz) is missing expected
# flashable artifacts or sizes look wrong. R2 uploads use the tarball — verify that file
# so docs-only or empty archives cannot slip through.
#
# Usage: verify-fw-bundle-stage.sh BUILD_DIR STAGE_DIR_OR_TARBALL
#   BUILD_DIR            = absolute path to .pio/build/<env> (ESP32 vs nRF52-class)
#   STAGE_DIR_OR_TARBALL = directory passed to scripts/ci/common/package-firmware-to-stage.sh, OR path to
#                          the gzip tarball produced by: tar -czf out.tgz -C "$STAGE" .
set -euo pipefail

BUILD_DIR=${1:?usage: verify-fw-bundle-stage.sh BUILD_DIR STAGE_DIR_OR_TARBALL}
ARTIFACT=${2:?usage: verify-fw-bundle-stage.sh BUILD_DIR STAGE_DIR_OR_TARBALL}
VERIFY_ARTIFACT_PATH="$ARTIFACT"

fail_verify() {
  echo "$1" >&2
  fw_bundle_verify_print_diagnostics
  exit 1
}

fw_bundle_verify_print_diagnostics() {
  echo "" >&2
  echo "========== Firmware bundle verification diagnostics ==========" >&2
  if [ -f "${VERIFY_ARTIFACT_PATH:-}" ]; then
    case "${VERIFY_ARTIFACT_PATH}" in
      *.tar.gz|*.tgz)
        echo "--- Tarball member list: ${VERIFY_ARTIFACT_PATH} ---" >&2
        tar -tzf "${VERIFY_ARTIFACT_PATH}" 2>&1 >&2 || echo "(failed to list tarball)" >&2
        ;;
    esac
  fi
  if [ -d "$BUILD_DIR" ]; then
    echo "--- Build output directory listing: $BUILD_DIR ---" >&2
    ls -la "$BUILD_DIR" 2>&1 >&2 || echo "(ls build dir failed)" >&2
    echo "--- Firmware-related files under build dir (max depth 3, capped) ---" >&2
    find "$BUILD_DIR" -maxdepth 3 -type f \( \
      -name '*.bin' -o -name '*.uf2' -o -name '*.hex' -o -name '*.elf' -o -name '*.json' -o -name '*.mt.json' \
      \) -print 2>/dev/null | head -200 >&2 || true
  else
    echo "--- BUILD_DIR not a directory: $BUILD_DIR ---" >&2
  fi
  if [ -n "${STAGE_DIR:-}" ] && [ -d "$STAGE_DIR" ]; then
    echo "--- Staged / extracted tree (all files) ---" >&2
    find "$STAGE_DIR" -type f -print 2>/dev/null | sort >&2 || true
  fi
  echo "========== End diagnostics ==========" >&2
}

if [ ! -d "$BUILD_DIR" ]; then
  echo "BUILD_DIR is not a directory: $BUILD_DIR" >&2
  exit 1
fi

EXTRACT=""
cleanup() {
  [ -n "$EXTRACT" ] && rm -rf "$EXTRACT"
}
trap cleanup EXIT

if [ -f "$ARTIFACT" ]; then
  case "$ARTIFACT" in
    *.tar.gz|*.tgz) ;;
    *)
      fail_verify "When second arg is a file, it must be .tar.gz or .tgz: $ARTIFACT"
      ;;
  esac
  if ! tar -tzf "$ARTIFACT" >/dev/null 2>&1; then
    fail_verify "Not a readable gzip tarball: $ARTIFACT"
  fi
  arch_bytes=$(wc -c <"$ARTIFACT" | tr -d ' ')
  if [ "$arch_bytes" -lt 2048 ]; then
    fail_verify "Tarball file too small ($arch_bytes bytes), likely corrupt or empty: $ARTIFACT"
  fi
  EXTRACT=$(mktemp -d "${TMPDIR:-/tmp}/fw-bundle-verify.XXXXXX")
  tar -xzf "$ARTIFACT" -C "$EXTRACT"
  STAGE_DIR="$EXTRACT"
  echo "Verifying tarball ($(basename "$ARTIFACT"), $arch_bytes bytes) -> extracted under $STAGE_DIR"
  members=$(tar -tzf "$ARTIFACT" | grep -c . || true)
  if [ "${members:-0}" -lt 1 ]; then
    fail_verify "Tarball lists zero members: $ARTIFACT"
  fi
elif [ -d "$ARTIFACT" ]; then
  STAGE_DIR="$ARTIFACT"
  echo "Verifying staged directory: $STAGE_DIR"
else
  fail_verify "Second arg must be a stage directory or a .tar.gz/.tgz file: $ARTIFACT"
fi

# Any flashable-looking payload (docs-only tarballs must fail before bundle-class rules).
_flashable=$(find "$STAGE_DIR" -type f \( -name '*.bin' -o -name '*.uf2' -o -name '*.hex' \) 2>/dev/null | head -1 || true)
if [ -z "$_flashable" ]; then
  fail_verify "Bundle has no flashable files (.bin, .uf2, or .hex) — likely docs-only or empty."
fi
unset _flashable

bytes() {
  wc -c <"$1" | tr -d ' '
}

largest_staged_bin() {
  local best="" bestz=-1 f z
  shopt -s nullglob
  for f in "$STAGE_DIR"/*.bin; do
    [ -f "$f" ] || continue
    z=$(bytes "$f")
    if [ "$z" -gt "$bestz" ]; then
      bestz=$z
      best=$f
    fi
  done
  shopt -u nullglob
  printf '%s' "$best"
}

largest_staged_uf2() {
  local best="" f z bestz=-1
  shopt -s nullglob
  for f in "$STAGE_DIR"/*.uf2; do
    [ -f "$f" ] || continue
    z=$(bytes "$f")
    if [ "$z" -gt "$bestz" ]; then
      bestz=$z
      best=$f
    fi
  done
  shopt -u nullglob
  printf '%s' "$best"
}

largest_staged_hex() {
  local best="" f z bestz=-1
  shopt -s nullglob
  for f in "$STAGE_DIR"/*.hex; do
    [ -f "$f" ] || continue
    z=$(bytes "$f")
    if [ "$z" -gt "$bestz" ]; then
      bestz=$z
      best=$f
    fi
  done
  shopt -u nullglob
  printf '%s' "$best"
}

# Tunable minima (bytes) — catch empty/truncated outputs without being brittle across releases.
MIN_ESP32_BIN=$((300 * 1024))
MIN_NRF52_APP=$((128 * 1024))
MIN_NRF52_DAT=8
MIN_MANIFEST=80
MIN_UF2=$((200 * 1024))
MIN_HEX=$((64 * 1024))

echo "Bundle check: BUILD_DIR=$BUILD_DIR"

if [ -f "$BUILD_DIR/bootloader.bin" ]; then
  echo "Bundle class: ESP32 (bootloader.bin in build tree)"
  best=$(largest_staged_bin)
  if [ -z "$best" ]; then
    fail_verify "ESP32 bundle: no *.bin at archive root (R2 tarball would be unusable for flash)"
  fi
  z=$(bytes "$best")
  if [ "$z" -lt "$MIN_ESP32_BIN" ]; then
    fail_verify "ESP32 bundle: largest .bin too small ($z bytes < $MIN_ESP32_BIN): $best"
  fi
  echo "ESP32 bundle OK: primary image $(basename "$best") size=$z bytes"
  exit 0
fi

echo "Bundle class: non-ESP32 (expect nRF52-style DFU, UF2, or HEX in archive/stage)"

if [ -f "$STAGE_DIR/firmware.bin" ] && [ -f "$STAGE_DIR/firmware.dat" ]; then
  zb=$(bytes "$STAGE_DIR/firmware.bin")
  zd=$(bytes "$STAGE_DIR/firmware.dat")
  if [ "$zb" -lt "$MIN_NRF52_APP" ]; then
    fail_verify "nRF52 bundle: firmware.bin too small ($zb < $MIN_NRF52_APP)"
  fi
  if [ "$zd" -lt "$MIN_NRF52_DAT" ]; then
    fail_verify "nRF52 bundle: firmware.dat too small ($zd < $MIN_NRF52_DAT)"
  fi
  if [ ! -f "$STAGE_DIR/manifest.json" ]; then
    fail_verify "nRF52 bundle: missing manifest.json"
  fi
  zm=$(bytes "$STAGE_DIR/manifest.json")
  if [ "$zm" -lt "$MIN_MANIFEST" ]; then
    fail_verify "nRF52 bundle: manifest.json too small ($zm < $MIN_MANIFEST)"
  fi
  echo "nRF52 DFU bundle OK: firmware.bin=$zb firmware.dat=$zd manifest.json=$zm bytes"
  exit 0
fi

uf2=$(largest_staged_uf2)
if [ -n "$uf2" ]; then
  zu=$(bytes "$uf2")
  if [ "$zu" -lt "$MIN_UF2" ]; then
    fail_verify "UF2 bundle: $(basename "$uf2") too small ($zu < $MIN_UF2)"
  fi
  echo "UF2 bundle OK: $(basename "$uf2") size=$zu bytes"
  exit 0
fi

hex=$(largest_staged_hex)
if [ -n "$hex" ]; then
  zh=$(bytes "$hex")
  if [ "$zh" -lt "$MIN_HEX" ]; then
    fail_verify "HEX bundle: $(basename "$hex") too small ($zh < $MIN_HEX)"
  fi
  echo "HEX-only bundle OK: $(basename "$hex") size=$zh bytes"
  exit 0
fi

fail_verify "No recognized firmware payload in bundle (expected ESP32 .bin at root, or nRF52 firmware.bin+.dat+manifest, or UF2/HEX at root)"
