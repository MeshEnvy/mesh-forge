#!/usr/bin/env bash
# Download BLE/unified OTA companion image into PlatformIO BUILD_DIR when Meshtastic *.mt.json is present.
# No-op for non-Meshtastic builds (no mt.json). Mirrors samples/projects/meshtastic-firmware/.github/workflows/build_firmware.yml.
set -euo pipefail

BUILD_DIR="${1:?usage: download-meshtastic-ota.sh BUILD_DIR}"

shopt -s nullglob
mt_json=( "$BUILD_DIR"/*.mt.json )
shopt -u nullglob

if [ "${#mt_json[@]}" -eq 0 ]; then
  echo "No *.mt.json in $BUILD_DIR — skip OTA download"
  exit 0
fi

# Prefer firmware-*.mt.json when multiple (same heuristic as emit-flash-manifest.py)
MT_JSON=""
for f in "${mt_json[@]}"; do
  base=$(basename "$f")
  if [[ "$base" =~ ^firmware-.+\.mt\.json$ ]]; then
    MT_JSON=$f
    break
  fi
done
if [ -z "$MT_JSON" ]; then
  MT_JSON="${mt_json[0]}"
fi

MCU=$(python3 -c "import json,sys; print((json.load(open(sys.argv[1], encoding='utf-8')).get('mcu') or '').lower())" "$MT_JSON")

case "$MCU" in
  esp32|esp32s3)
    dest="$BUILD_DIR/mt-${MCU}-ota.bin"
    if [ -f "$dest" ]; then
      echo "OTA already present: $dest"
      exit 0
    fi
    url="https://github.com/meshtastic/esp32-unified-ota/releases/latest/download/mt-${MCU}-ota.bin"
    echo "Downloading $url -> $dest"
    curl -fsSL -o "$dest" "$url"
    ;;
  esp32c3|esp32c6)
    dest="$BUILD_DIR/bleota-c3.bin"
    if [ -f "$dest" ]; then
      echo "OTA already present: $dest"
      exit 0
    fi
    url="https://github.com/meshtastic/firmware-ota/releases/latest/download/firmware-c3.bin"
    echo "Downloading $url -> $dest"
    curl -fsSL -o "$dest" "$url"
    ;;
  *)
    echo "MCU '$MCU' — no Meshtastic GitHub OTA download rule; skip"
    exit 0
    ;;
esac
