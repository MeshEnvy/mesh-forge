#!/usr/bin/env python3
"""
Emit flash-manifest.json for Mesh Forge USB flasher.

If BUILD_DIR/flash-manifest.json already exists (project-supplied), leave it.
Otherwise, if Meshtastic-style *.mt.json is present, synthesize a manifest
from partition table + on-disk artifacts.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys


def parse_offset(v: object) -> int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if not s:
        return None
    if s.lower().startswith("0x"):
        return int(s, 16)
    return int(s, 10)


def list_basenames(build_dir: str) -> set[str]:
    out: set[str] = set()
    for p in glob.glob(os.path.join(build_dir, "*")):
        if os.path.isfile(p):
            out.add(os.path.basename(p))
    return out


def part_offset_for_slot(parts: list[dict], part_name: str) -> int | None:
    for p in parts:
        if str(p.get("name", "")) == part_name:
            o = parse_offset(p.get("offset"))
            if o is not None:
                return o
    for p in parts:
        if str(p.get("subtype", "")) == part_name:
            o = parse_offset(p.get("offset"))
            if o is not None:
                return o
    if part_name == "app0":
        for p in parts:
            if p.get("type") == "app" and p.get("subtype") == "ota_0":
                o = parse_offset(p.get("offset"))
                if o is not None:
                    return o
    if part_name == "spiffs":
        for p in parts:
            if str(p.get("subtype", "")) == "spiffs":
                o = parse_offset(p.get("offset"))
                if o is not None:
                    return o
    return None


def factory_app_offset(parts: list[dict]) -> int:
    for p in parts:
        if str(p.get("subtype", "")) == "factory":
            o = parse_offset(p.get("offset"))
            if o is not None:
                return o
    for p in parts:
        if p.get("type") == "app" and p.get("subtype") == "ota_0":
            o = parse_offset(p.get("offset"))
            if o is not None:
                return o
    return 0x10000


def ota1_offset(parts: list[dict]) -> int | None:
    for p in parts:
        if str(p.get("subtype", "")) == "ota_1":
            return parse_offset(p.get("offset"))
    return None


def spiffs_offset(parts: list[dict]) -> int | None:
    return part_offset_for_slot(parts, "spiffs")


def emit_from_mt(build_dir: str, mt: dict) -> dict | None:
    parts: list[dict] = mt.get("part") or []
    if not parts:
        return None

    names = list_basenames(build_dir)
    images: list[dict] = []
    seen: set[str] = set()

    def add(file: str, offset: int, optional: bool = False) -> None:
        if file not in names or file in seen:
            return
        row: dict = {"file": file, "offset": offset}
        if optional:
            row["optional"] = True
        images.append(row)
        seen.add(file)

    add("bootloader.bin", 0x1000)
    add("partitions.bin", 0x8000)
    add("boot_app0.bin", 0xE000)

    for entry in mt.get("files") or []:
        fname = entry.get("name")
        part_name = entry.get("part_name")
        if not fname or not part_name or fname not in names:
            continue
        off = part_offset_for_slot(parts, str(part_name))
        if off is None:
            continue
        opt = bool(
            fname.startswith("littlefs-")
            or re.match(r"^mt-.+-ota\.bin$", fname, re.I)
            or (
                re.match(r"^firmware-.+\.bin$", fname, re.I)
                and not re.search(r"\.factory\.bin$", fname, re.I)
            )
        )
        add(fname, off, optional=opt)

    factory_bins = sorted(n for n in names if re.match(r"^firmware-.+\.factory\.bin$", n, re.I))
    if factory_bins:
        add(factory_bins[0], factory_app_offset(parts))

    for n in sorted(names):
        if n.startswith("littlefs-") and n.endswith(".bin"):
            off = spiffs_offset(parts)
            if off is not None:
                add(n, off, optional=True)

    for n in sorted(names):
        if re.match(r"^mt-.+-ota\.bin$", n, re.I):
            off = ota1_offset(parts)
            if off is not None:
                add(n, off, optional=True)

    if not images:
        return None

    if not any(re.match(r"^firmware-.+\.bin$", im["file"], re.I) for im in images):
        return None

    def sort_key(im: dict) -> int:
        o = im["offset"]
        return int(o) if isinstance(o, int) else parse_offset(o) or 0

    images.sort(key=sort_key)
    return {"images": images}


def pick_mt_json(build_dir: str) -> str | None:
    paths = glob.glob(os.path.join(build_dir, "*.mt.json"))
    if not paths:
        return None
    if len(paths) == 1:
        return paths[0]
    fw = [p for p in paths if re.search(r"firmware-.+\.mt\.json$", os.path.basename(p), re.I)]
    return fw[0] if fw else paths[0]


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: emit-flash-manifest.py BUILD_DIR", file=sys.stderr)
        return 2
    build_dir = os.path.abspath(sys.argv[1])
    out_path = os.path.join(build_dir, "flash-manifest.json")

    if os.path.isfile(out_path):
        print(f"Keeping existing {out_path}")
        return 0

    mt_path = pick_mt_json(build_dir)
    if not mt_path:
        print("No *.mt.json; not emitting flash-manifest.json")
        return 0

    with open(mt_path, encoding="utf-8") as f:
        mt = json.load(f)

    manifest = emit_from_mt(build_dir, mt)
    if not manifest:
        print("Could not synthesize flash-manifest.json from mt.json")
        return 0

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
