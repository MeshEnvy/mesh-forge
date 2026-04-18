#!/usr/bin/env bash
# Unpack PlatformIO nRF52 DFU archives from the build directory (any *.zip name),
# then normalize application + init packet to firmware.bin / firmware.dat and align
# manifest.json when present. Typical layout is one zip per environment; multiple
# zips are processed in glob order (same member names are last-wins).
#
# Usage: stage-nrf52-dfu-from-build.sh BUILD_DIR
set -euo pipefail

BUILD_DIR="${1:?usage: stage-nrf52-dfu-from-build.sh BUILD_DIR}"

zip_looks_like_dfu() {
  # Heuristic: DFU package includes a .dat init packet (member path ends in .dat).
  unzip -l "$1" 2>/dev/null | grep -qE '[.]dat$'
}

normalize_pair() {
  local src_bin="$1"
  local src_dat="$2"

  if [ -z "$src_bin" ] || [ -z "$src_dat" ]; then
    return 0
  fi
  if [ "$src_bin" = 'firmware.bin' ] && [ "$src_dat" = 'firmware.dat' ]; then
    echo "DFU application already firmware.bin / firmware.dat"
    return 0
  fi
  if [ ! -f "$BUILD_DIR/$src_bin" ] || [ ! -f "$BUILD_DIR/$src_dat" ]; then
    return 0
  fi

  echo "Normalizing DFU payload: $src_bin + $src_dat -> firmware.bin + firmware.dat"
  cp -a "$BUILD_DIR/$src_bin" "$BUILD_DIR/firmware.bin"
  cp -a "$BUILD_DIR/$src_dat" "$BUILD_DIR/firmware.dat"

  if [ -f "$BUILD_DIR/manifest.json" ] && command -v jq >/dev/null 2>&1; then
    local tmp
    tmp="$(mktemp)"
    jq '.manifest.application.bin_file = "firmware.bin" | .manifest.application.dat_file = "firmware.dat"' \
      "$BUILD_DIR/manifest.json" >"$tmp" && mv "$tmp" "$BUILD_DIR/manifest.json"
  fi
}

shopt -s nullglob
for z in "$BUILD_DIR"/*.zip; do
  [ -f "$z" ] || continue
  if ! zip_looks_like_dfu "$z"; then
    echo "Skipping zip (no .dat member): $z"
    continue
  fi
  echo "Extracting DFU zip: $z"
  unzip -jo "$z" '*.bin' '*.dat' 'manifest.json' -d "$BUILD_DIR/" || true
done
shopt -u nullglob

src_bin=""
src_dat=""

if [ -f "$BUILD_DIR/manifest.json" ] && command -v jq >/dev/null 2>&1; then
  src_bin="$(jq -r '.manifest.application.bin_file // empty' "$BUILD_DIR/manifest.json" 2>/dev/null || true)"
  src_dat="$(jq -r '.manifest.application.dat_file // empty' "$BUILD_DIR/manifest.json" 2>/dev/null || true)"
fi

if [ -n "$src_bin" ] && [ -n "$src_dat" ] && [ -f "$BUILD_DIR/$src_bin" ] && [ -f "$BUILD_DIR/$src_dat" ]; then
  normalize_pair "$src_bin" "$src_dat"
elif [ -f "$BUILD_DIR/firmware.bin" ] && [ -f "$BUILD_DIR/firmware.dat" ]; then
  echo "DFU payload already firmware.bin / firmware.dat"
else
  shopt -s nullglob
  dats=("$BUILD_DIR"/*.dat)
  shopt -u nullglob
  if [ "${#dats[@]}" -eq 1 ]; then
    dat="${dats[0]}"
    base="$(basename "$dat" .dat)"
    if [ -f "$BUILD_DIR/${base}.bin" ]; then
      normalize_pair "${base}.bin" "$(basename "$dat")"
    fi
  fi
fi
