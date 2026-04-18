#!/usr/bin/env bash
# When no merged *.factory.bin exists, stage the main application .bin for Web Serial flashing
# (single image at 0x0). Picks the largest .bin excluding common ESP-IDF / partition artifacts.
#
# Usage: copy-esp32-app-bin-for-bundle.sh BUILD_DIR STAGE_DIR
set -euo pipefail

BUILD_DIR="${1:?usage: copy-esp32-app-bin-for-bundle.sh BUILD_DIR STAGE_DIR}"
STAGE_DIR="${2:?usage: copy-esp32-app-bin-for-bundle.sh BUILD_DIR STAGE_DIR}"

is_excluded() {
  local bl
  bl=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  case "$bl" in
    bootloader.bin|partitions.bin|boot_app0.bin) return 0 ;;
  esac
  return 1
}

shopt -s nullglob
bins=( "$BUILD_DIR"/*.bin )
shopt -u nullglob

eligible=()
for f in "${bins[@]}"; do
  [ -f "$f" ] || continue
  is_excluded "$(basename "$f")" && continue
  eligible+=("$f")
done

if [ "${#eligible[@]}" -eq 0 ]; then
  echo "No eligible application .bin under $BUILD_DIR"
  exit 1
fi

best=""
bestz=-1
for f in "${eligible[@]}"; do
  z=$(wc -c <"$f" | tr -d ' ')
  if [ "$z" -gt "$bestz" ]; then
    bestz=$z
    best=$f
  fi
done

bn=$(basename "$best")
echo "Staging ESP32 application binary (no factory merge): $bn"
cp -a "$best" "$STAGE_DIR/$bn"
