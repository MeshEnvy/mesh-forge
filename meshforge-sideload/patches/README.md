# MeshForge Meshtastic patches

Two patches against Meshtastic firmware that enable MeshForge data sideloading.
Both are pending upstream merge. Once merged, these patches and the apply script
become unnecessary.

---

## 00-xmodem-truncate-fix.patch

**PR title:** `fix(xmodem): truncate file on open instead of appending`

Standalone 2-line fix. `FILE_O_WRITE` on nRF52 (Adafruit LittleFS) appends to
existing files rather than truncating. Removes the file before opening for write
so repeated XModem uploads always produce the correct file size. Independent of
the other two patches — can be reviewed and merged on its own.

**Sentinel:** `Remove existing file first so we truncate`

---

## 01-nrf-external-flash.patch

**PR title:** `feat(nrf52): optional external QSPI LittleFS filesystem`

Adds infrastructure for mounting the external QSPI flash chip as a LittleFS
volume on nRF52840 boards that have it wired:

- `src/FSCommon.h` — `extern Adafruit_LittleFS* extFS` pointer + `extFSInit()` declaration
- `src/FSCommon.cpp` — `extFS = nullptr` global, weak `extFSInit()` no-op, called from `fsInit()`
- `src/platform/nrf52/extfs-nrf52.cpp` — actual QSPI init + LittleFS mount using `nrfx_qspi`
- `variants/nrf52840/{t-echo,t-echo-lite,t-echo-plus,nano-g2-ultra,rak_wismeshtap}/variant.h` — add `MESHTASTIC_EXTERNAL_FLASH_FS`

**Sentinel:** `extFSInit`

---

## 02-xmodem-vfs-routing.patch

**PR title:** `feat(nrf52): virtual filesystem mount points + XModem path routing`

Depends on patch 01. Adds a lightweight VFS routing layer and wires XModem into it:

- `src/FSCommon.h` — `FsMount` enum, `FSRoute` struct, `fsRoute()` + helpers
- `src/FSCommon.cpp` — routing and helper implementations
- `src/xmodem.h` / `src/xmodem.cpp` — XModem uses `fsRoute()` for `/__ext__/` and `/__int__/` paths

Path prefix convention:

| Prefix | Destination |
|--------|-------------|
| `/__ext__/foo` | `extFS` if mounted, else internal |
| `/__int__/foo` | Internal flash (InternalFS / LittleFS) |
| `/__sd__/foo` | SD card (reserved, falls back to internal) |
| `/foo` | Internal flash — bare paths unchanged |

**Sentinel:** `fsRoute`

---

## Applying

```bash
# From within a Meshtastic firmware checkout:
git apply meshforge-sideload/patches/01-nrf-external-flash.patch
git apply meshforge-sideload/patches/02-xmodem-vfs-routing.patch
```

Or via PlatformIO extra_scripts (applied automatically at build time):

```ini
[env]
extra_scripts = pre:path/to/meshforge-sideload/patches/apply_patches.py
```

## Reverting

```bash
git apply -R meshforge-sideload/patches/02-xmodem-vfs-routing.patch
git apply -R meshforge-sideload/patches/01-nrf-external-flash.patch
```
