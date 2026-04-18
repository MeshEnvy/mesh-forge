#!/usr/bin/env bash
# Copy README and license files from repo root into the firmware tarball stage when present.
set -euo pipefail
ROOT="${1:?root dir}"
STAGE="${2:?stage dir}"

shopt -s nocaseglob
for f in "$ROOT"/readme* "$ROOT"/license* "$ROOT"/copying* "$ROOT"/copyright*; do
  [[ -f "$f" ]] && cp -a "$f" "$STAGE/"
done
shopt -u nocaseglob
