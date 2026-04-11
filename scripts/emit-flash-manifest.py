#!/usr/bin/env python3
"""
Emit flash-manifest.json for Mesh Forge USB flasher.

If BUILD_DIR/flash-manifest.json already exists (project-supplied), merge in
targetFamily from PlatformIO when missing.

Otherwise, if Meshtastic-style *.mt.json is present, synthesize one JSON with:
  - "update": app @ ota_0 + BLE OTA @ ota_1, eraseFlash false (Meshtastic “Update”).
  - "factory": merged *.factory.bin @ 0 + OTA + LittleFS, eraseFlash true (Meshtastic “Erase device”),
    omitted if no factory.bin in BUILD_DIR.

OTA: mt-*-ota.bin (ESP32/S3) or bleota-c3.bin (C3/C6).

Optional args: PROJECT_ROOT TARGET_ENV — merged PIO config for that env fills
targetFamily (and platform/board) for the USB flasher UI.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys


def _normalize_platform(platform: str | None) -> str:
    if not platform:
        return ""
    p = platform.strip().lower()
    if "#" in p:
        p = p.split("#", 1)[0].strip()
    if "@" in p:
        p = p.split("@", 1)[0].strip()
    if "/" in p:
        p = p.rsplit("/", 1)[-1].strip()
    return p


def _platform_to_target_family(platform: str | None, board: str | None) -> str:
    pl = _normalize_platform(platform)
    b = (board or "").lower()
    if "8266" in pl or "esp8266" in b:
        return "esp8266"
    if "nrf52" in pl or "nrf52840" in b or "nrf52833" in b or "nrf52832" in b:
        return "nrf52"
    if "rp2040" in pl or "rp2040" in b or "raspberrypi" in pl:
        return "rp2040"
    if "espressif32" in pl or "esp32" in pl or "esp32" in b or "esp32c3" in b or "esp32s3" in b:
        return "esp32"
    return "unknown"


def _resolve_pio_target_family(project_root: str, target_env: str) -> tuple[str, str | None, str | None]:
    try:
        from platformio.project.config import ProjectConfig
    except ImportError:
        print("platformio not installed; targetFamily will be unknown", file=sys.stderr)
        return "unknown", None, None

    ini = os.path.join(project_root, "platformio.ini")
    if not os.path.isfile(ini):
        return "unknown", None, None

    old = os.getcwd()
    try:
        os.chdir(project_root)
        config = ProjectConfig("platformio.ini")
        section = f"env:{target_env}"
        if section not in config.sections():
            print(f"PIO env not found: {target_env!r}", file=sys.stderr)
            return "unknown", None, None
        platform = config.get(section, "platform")
        board = config.get(section, "board")
        fam = _platform_to_target_family(platform, board)
        return fam, platform, board
    except Exception as e:
        print(f"PIO targetFamily resolution failed: {e}", file=sys.stderr)
        return "unknown", None, None
    finally:
        os.chdir(old)


def _merge_target_family_meta(
    manifest: dict,
    target_family: str,
    platform: str | None,
    board: str | None,
) -> dict:
    """Add targetFamily / platform / board only when absent."""
    out = dict(manifest)
    if "targetFamily" not in out:
        out["targetFamily"] = target_family
    if platform and "platform" not in out:
        out["platform"] = platform.strip() if isinstance(platform, str) else platform
    if board and "board" not in out:
        out["board"] = board.strip() if isinstance(board, str) else board
    return out


def _write_manifest(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


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


def ota1_offset(parts: list[dict]) -> int | None:
    for p in parts:
        if str(p.get("subtype", "")) == "ota_1":
            return parse_offset(p.get("offset"))
    return None


def spiffs_offset(parts: list[dict]) -> int | None:
    return part_offset_for_slot(parts, "spiffs")


def _offset_int(im: dict) -> int:
    o = im["offset"]
    return int(o) if isinstance(o, int) else parse_offset(o) or 0


def _dedupe_same_offset(images: list[dict]) -> list[dict]:
    """One esptool image per physical offset (prefer non-optional, then lexicographic file)."""
    buckets: dict[int, list[dict]] = {}
    for im in images:
        buckets.setdefault(_offset_int(im), []).append(im)

    out: list[dict] = []
    for off in sorted(buckets):
        group = buckets[off]
        out.append(
            group[0]
            if len(group) == 1
            else min(group, key=lambda im: (im.get("optional") is True, str(im.get("file", ""))))
        )
    return out


def _is_non_factory_firmware(name: str) -> bool:
    return bool(re.match(r"^firmware-.+\.bin$", name, re.I) and not re.search(r"\.factory\.bin$", name, re.I))


def pick_factory_bin(names: set[str]) -> str | None:
    cands = sorted(n for n in names if re.match(r"^firmware-.+\.factory\.bin$", n, re.I))
    return cands[0] if cands else None


def pick_non_factory_firmware(names: set[str], mt: dict) -> str | None:
    for entry in mt.get("files") or []:
        fname = entry.get("name")
        if not fname or fname not in names or entry.get("part_name") != "app0":
            continue
        if _is_non_factory_firmware(fname):
            return fname
    for n in sorted(names):
        if _is_non_factory_firmware(n):
            return n
    return None


def emit_meshtastic_update(build_dir: str, mt: dict) -> dict | None:
    """Official-style update: app @ ota_0 + OTA @ ota_1 only (no erase, no factory, no FS)."""
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

    app_bin = pick_non_factory_firmware(names, mt)
    if not app_bin:
        return None
    off0 = part_offset_for_slot(parts, "app0")
    if off0 is None:
        return None
    add(app_bin, off0, optional=False)

    ota_added = False
    for n in sorted(names):
        if re.match(r"^mt-.+-ota\.bin$", n, re.I):
            o = ota1_offset(parts)
            if o is not None:
                add(n, o, optional=False)
                ota_added = True
            break
    if not ota_added and "bleota-c3.bin" in names:
        o = ota1_offset(parts)
        if o is not None:
            add("bleota-c3.bin", o, optional=False)

    images = _dedupe_same_offset(images)
    images.sort(key=_offset_int)
    return {"images": images, "eraseFlash": False}


def emit_meshtastic_full(build_dir: str, mt: dict, factory_bin: str) -> dict | None:
    """Official-style erase + factory: merged factory @ 0 + OTA + LittleFS."""
    parts: list[dict] = mt.get("part") or []
    if not parts:
        return None
    names = list_basenames(build_dir)
    if factory_bin not in names:
        return None

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

    add(factory_bin, 0, optional=False)

    ota_added = False
    for n in sorted(names):
        if re.match(r"^mt-.+-ota\.bin$", n, re.I):
            o = ota1_offset(parts)
            if o is not None:
                add(n, o, optional=False)
                ota_added = True
            break
    if not ota_added and "bleota-c3.bin" in names:
        o = ota1_offset(parts)
        if o is not None:
            add("bleota-c3.bin", o, optional=False)

    for n in sorted(names):
        if n.startswith("littlefs-") and n.endswith(".bin"):
            so = spiffs_offset(parts)
            if so is not None:
                add(n, so, optional=False)

    for entry in mt.get("files") or []:
        fname = entry.get("name")
        part_name = entry.get("part_name")
        if not fname or part_name != "spiffs" or fname not in names:
            continue
        if not str(fname).lower().startswith("littlefs-"):
            continue
        so = spiffs_offset(parts)
        if so is not None:
            add(fname, so, optional=False)

    images = _dedupe_same_offset(images)
    images.sort(key=_offset_int)

    o1 = ota1_offset(parts)
    if o1 is not None and not any(_offset_int(im) == o1 for im in images):
        return None

    return {"images": images, "eraseFlash": True}


def pick_mt_json(build_dir: str) -> str | None:
    paths = glob.glob(os.path.join(build_dir, "*.mt.json"))
    if not paths:
        return None
    if len(paths) == 1:
        return paths[0]
    fw = [p for p in paths if re.search(r"firmware-.+\.mt\.json$", os.path.basename(p), re.I)]
    return fw[0] if fw else paths[0]


# ---------------------------------------------------------------------------
# Path 3 — generic nRF52 (UF2 bootloader, no *.mt.json)
# ---------------------------------------------------------------------------

def _pick_firmware_uf2(names: set[str]) -> str | None:
    """Return the best candidate firmware *.uf2 (exclude nuke.uf2)."""
    cands = sorted(
        n for n in names
        if n.lower().endswith(".uf2") and n.lower() != "nuke.uf2"
    )
    # Prefer names starting with "firmware"
    fw = [n for n in cands if n.lower().startswith("firmware")]
    return fw[0] if fw else (cands[0] if cands else None)


def emit_generic_nrf52(names: set[str]) -> dict | None:
    """
    Emit a UF2-based manifest for nRF52 builds.
    update: firmware *.uf2 with role "uf2"
    factory (optional): nuke.uf2 (role "nuke") + firmware *.uf2, eraseFlash true
    """
    fw_uf2 = _pick_firmware_uf2(names)
    if not fw_uf2:
        return None

    doc: dict = {
        "update": {
            "images": [{"file": fw_uf2, "offset": 0, "role": "uf2"}],
            "eraseFlash": False,
        }
    }

    if "nuke.uf2" in names:
        doc["factory"] = {
            "images": [
                {"file": "nuke.uf2", "offset": 0, "role": "nuke"},
                {"file": fw_uf2, "offset": 0, "role": "uf2"},
            ],
            "eraseFlash": True,
        }

    return doc


# ---------------------------------------------------------------------------
# Path 4 — generic ESP32 (standard PlatformIO bins, no *.mt.json)
# ---------------------------------------------------------------------------

# Standard PlatformIO ESP32 flash offsets
_ESP32_OFFSETS: dict[str, int] = {
    "bootloader.bin": 0x1000,
    "partitions.bin": 0x8000,
    "boot_app0.bin": 0xE000,
}
_ESP32_APP_OFFSET = 0x10000


def _pick_esp32_app_bin(names: set[str]) -> str | None:
    """Return firmware app bin (versioned or exact), excluding factory images."""
    if "firmware.bin" in names:
        return "firmware.bin"
    cands = sorted(
        n for n in names
        if re.match(r"^firmware-.+\.bin$", n, re.I) and not re.search(r"\.factory\.bin$", n, re.I)
    )
    return cands[0] if cands else None


def emit_generic_esp32(names: set[str]) -> dict | None:
    """
    Emit a standard ESP32 manifest from PlatformIO bin output.
    update: bootloader + partitions + app (+ boot_app0 if present)
    factory (optional): firmware-*.factory.bin @ 0x0, eraseFlash true
    """
    bootloader = "bootloader.bin" if "bootloader.bin" in names else None
    partitions = "partitions.bin" if "partitions.bin" in names else None
    app_bin = _pick_esp32_app_bin(names)

    if not (bootloader and partitions and app_bin):
        # Not enough for a canonical ESP32 layout
        return None

    update_images: list[dict] = [
        {"file": "bootloader.bin", "offset": _ESP32_OFFSETS["bootloader.bin"]},
        {"file": "partitions.bin", "offset": _ESP32_OFFSETS["partitions.bin"]},
    ]
    if "boot_app0.bin" in names:
        update_images.append({"file": "boot_app0.bin", "offset": _ESP32_OFFSETS["boot_app0.bin"]})
    update_images.append({"file": app_bin, "offset": _ESP32_APP_OFFSET})
    update_images.sort(key=lambda im: im["offset"])

    doc: dict = {
        "update": {"images": update_images, "eraseFlash": False}
    }

    factory_bin = pick_factory_bin(names)
    if factory_bin:
        doc["factory"] = {
            "images": [{"file": factory_bin, "offset": 0}],
            "eraseFlash": True,
        }

    return doc


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    if len(sys.argv) < 2:
        print(
            "usage: emit-flash-manifest.py BUILD_DIR [PROJECT_ROOT TARGET_ENV]",
            file=sys.stderr,
        )
        return 2
    build_dir = os.path.abspath(sys.argv[1])
    project_root: str | None = None
    target_env: str | None = None
    if len(sys.argv) >= 4:
        project_root = os.path.abspath(sys.argv[2])
        target_env = sys.argv[3]

    pio_family, pio_platform, pio_board = (
        _resolve_pio_target_family(project_root, target_env)
        if project_root and target_env
        else ("unknown", None, None)
    )

    out_path = os.path.join(build_dir, "flash-manifest.json")

    # Path 1: existing manifest — merge targetFamily when absent
    if os.path.isfile(out_path):
        with open(out_path, encoding="utf-8") as f:
            manifest = json.load(f)
        if not isinstance(manifest, dict):
            print(f"Invalid existing {out_path}", file=sys.stderr)
            return 1
        ok_legacy = isinstance(manifest.get("images"), list)
        up = manifest.get("update")
        ok_dual = isinstance(up, dict) and isinstance(up.get("images"), list)
        if not ok_legacy and not ok_dual:
            print(f"Invalid existing {out_path} (need images[] or update.images[])", file=sys.stderr)
            return 1
        merged = _merge_target_family_meta(manifest, pio_family, pio_platform, pio_board)
        if merged != manifest:
            _write_manifest(out_path, merged)
            print(f"Merged targetFamily into {out_path}")
        else:
            print(f"Keeping existing {out_path} (targetFamily already set)")
        return 0

    names = list_basenames(build_dir)

    # Path 2: Meshtastic *.mt.json
    mt_path = pick_mt_json(build_dir)
    if mt_path:
        with open(mt_path, encoding="utf-8") as f:
            mt = json.load(f)

        manifest_update = emit_meshtastic_update(build_dir, mt)
        if not manifest_update:
            print("Could not synthesize flash-manifest.json (update) from mt.json")
            return 0

        doc: dict = {"update": manifest_update}
        factory = pick_factory_bin(names)
        if factory:
            manifest_full = emit_meshtastic_full(build_dir, mt, factory)
            if manifest_full:
                doc["factory"] = manifest_full
            else:
                print("Could not build factory section; omitting factory key", file=sys.stderr)
        else:
            print("No firmware-*.factory.bin in BUILD_DIR; omitting factory section")

        merged_doc = _merge_target_family_meta(doc, pio_family, pio_platform, pio_board)
        _write_manifest(out_path, merged_doc)
        print(f"Wrote {out_path} (update + {'factory' if 'factory' in merged_doc else 'no factory'})")
        return 0

    # Path 3: generic nRF52 (UF2 output)
    if pio_family == "nrf52":
        doc = emit_generic_nrf52(names)
        if doc:
            merged_doc = _merge_target_family_meta(doc, pio_family, pio_platform, pio_board)
            _write_manifest(out_path, merged_doc)
            print(f"Wrote {out_path} (nRF52 UF2, update + {'factory' if 'factory' in merged_doc else 'no factory'})")
            return 0
        print("nRF52 target but no *.uf2 found in BUILD_DIR; skipping manifest", file=sys.stderr)
        return 0

    # Path 4: generic ESP32 (standard PlatformIO bin output)
    if pio_family == "esp32":
        doc = emit_generic_esp32(names)
        if doc:
            merged_doc = _merge_target_family_meta(doc, pio_family, pio_platform, pio_board)
            _write_manifest(out_path, merged_doc)
            print(f"Wrote {out_path} (ESP32 bins, update + {'factory' if 'factory' in merged_doc else 'no factory'})")
            return 0
        print("ESP32 target but could not detect bootloader+partitions+firmware in BUILD_DIR; skipping manifest", file=sys.stderr)
        return 0

    print(f"No manifest source found for family={pio_family!r}; skipping flash-manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
