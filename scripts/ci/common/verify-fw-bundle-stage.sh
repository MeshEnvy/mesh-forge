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
      echo "When second arg is a file, it must be .tar.gz or .tgz: $ARTIFACT" >&2
      exit 1
      ;;
  esac
  if ! tar -tzf "$ARTIFACT" >/dev/null 2>&1; then
    echo "Not a readable gzip tarball: $ARTIFACT" >&2
    exit 1
  fi
  arch_bytes=$(wc -c <"$ARTIFACT" | tr -d ' ')
  if [ "$arch_bytes" -lt 2048 ]; then
    echo "Tarball file too small ($arch_bytes bytes), likely corrupt or empty: $ARTIFACT" >&2
    exit 1
  fi
  EXTRACT=$(mktemp -d "${TMPDIR:-/tmp}/fw-bundle-verify.XXXXXX")
  tar -xzf "$ARTIFACT" -C "$EXTRACT"
  STAGE_DIR="$EXTRACT"
  echo "Verifying tarball ($(basename "$ARTIFACT"), $arch_bytes bytes) -> extracted under $STAGE_DIR"
  members=$(tar -tzf "$ARTIFACT" | grep -c . || true)
  if [ "${members:-0}" -lt 1 ]; then
    echo "Tarball lists zero members: $ARTIFACT" >&2
    exit 1
  fi
elif [ -d "$ARTIFACT" ]; then
  STAGE_DIR="$ARTIFACT"
  echo "Verifying staged directory: $STAGE_DIR"
else
  echo "Second arg must be a stage directory or a .tar.gz/.tgz file: $ARTIFACT" >&2
  exit 1
fi

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
    echo "ESP32 bundle: no *.bin under archive/stage (R2 tarball would be unusable for flash)" >&2
    ls -la "$STAGE_DIR" >&2
    exit 1
  fi
  z=$(bytes "$best")
  if [ "$z" -lt "$MIN_ESP32_BIN" ]; then
    echo "ESP32 bundle: largest .bin too small ($z bytes < $MIN_ESP32_BIN): $best" >&2
    exit 1
  fi
  echo "ESP32 bundle OK: primary image $(basename "$best") size=$z bytes"
  exit 0
fi

echo "Bundle class: non-ESP32 (expect nRF52-style DFU, UF2, or HEX in archive/stage)"

if [ -f "$STAGE_DIR/firmware.bin" ] && [ -f "$STAGE_DIR/firmware.dat" ]; then
  zb=$(bytes "$STAGE_DIR/firmware.bin")
  zd=$(bytes "$STAGE_DIR/firmware.dat")
  if [ "$zb" -lt "$MIN_NRF52_APP" ]; then
    echo "nRF52 bundle: firmware.bin too small ($zb < $MIN_NRF52_APP)" >&2
    exit 1
  fi
  if [ "$zd" -lt "$MIN_NRF52_DAT" ]; then
    echo "nRF52 bundle: firmware.dat too small ($zd < $MIN_NRF52_DAT)" >&2
    exit 1
  fi
  if [ ! -f "$STAGE_DIR/manifest.json" ]; then
    echo "nRF52 bundle: missing manifest.json" >&2
    exit 1
  fi
  zm=$(bytes "$STAGE_DIR/manifest.json")
  if [ "$zm" -lt "$MIN_MANIFEST" ]; then
    echo "nRF52 bundle: manifest.json too small ($zm < $MIN_MANIFEST)" >&2
    exit 1
  fi
  echo "nRF52 DFU bundle OK: firmware.bin=$zb firmware.dat=$zd manifest.json=$zm bytes"
  exit 0
fi

uf2=$(largest_staged_uf2)
if [ -n "$uf2" ]; then
  zu=$(bytes "$uf2")
  if [ "$zu" -lt "$MIN_UF2" ]; then
    echo "UF2 bundle: $(basename "$uf2") too small ($zu < $MIN_UF2)" >&2
    exit 1
  fi
  echo "UF2 bundle OK: $(basename "$uf2") size=$zu bytes"
  exit 0
fi

hex=$(largest_staged_hex)
if [ -n "$hex" ]; then
  zh=$(bytes "$hex")
  if [ "$zh" -lt "$MIN_HEX" ]; then
    echo "HEX bundle: $(basename "$hex") too small ($zh < $MIN_HEX)" >&2
    exit 1
  fi
  echo "HEX-only bundle OK: $(basename "$hex") size=$zh bytes"
  exit 0
fi

echo "No recognized firmware payload in bundle (expected ESP32 .bin, or nRF52 firmware.bin+.dat+manifest, or UF2/HEX)" >&2
ls -la "$STAGE_DIR" >&2
exit 1
