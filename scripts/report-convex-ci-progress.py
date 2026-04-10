#!/usr/bin/env python3
"""POST CI step progress to Convex (used by custom_build*.yml). Env: REPO_BUILD_ID, CONVEX_URL, CONVEX_BUILD_TOKEN, STEP_INDEX, CI_PROGRESS_TOTAL, LABEL."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> None:
    try:
        repo_build_id = os.environ["REPO_BUILD_ID"]
        convex_url = os.environ["CONVEX_URL"].rstrip("/")
        token = os.environ["CONVEX_BUILD_TOKEN"]
        step_index = int(os.environ["STEP_INDEX"])
        step_total = int(os.environ["CI_PROGRESS_TOTAL"])
        label = os.environ["LABEL"]
    except KeyError as e:
        print(f"missing env: {e}", file=sys.stderr)
        sys.exit(1)

    if step_total < 1 or step_index < 1 or step_index > step_total:
        print("invalid STEP_INDEX / CI_PROGRESS_TOTAL", file=sys.stderr)
        sys.exit(1)

    body = {
        "repo_build_id": repo_build_id,
        "step_index": step_index,
        "step_total": step_total,
        "label": label,
    }
    url = f"{convex_url}/ingest-repo-build-progress"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print(e.read().decode() or str(e), file=sys.stderr)
        raise SystemExit(1) from e


if __name__ == "__main__":
    main()
