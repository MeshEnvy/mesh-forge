#!/usr/bin/env bash
# Copy README and license files from repo root into the firmware tarball stage when present.
set -euo pipefail
ROOT="${1:?root dir}"
STAGE="${2:?stage dir}"

for f in \
  README \
  README.md \
  README.rst \
  README.txt \
  readme.md \
  LICENSE \
  LICENSE.md \
  LICENSE.txt \
  COPYING \
  COPYRIGHT; do
  if [[ -f "$ROOT/$f" ]]; then
    cp -a "$ROOT/$f" "$STAGE/"
  fi
done
