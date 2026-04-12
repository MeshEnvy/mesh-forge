# meshforge-sideload

A PlatformIO plugin used by the [MeshForge](https://meshforge.org) web flasher to sideload data files to Meshtastic devices after flashing.

**This is not a C++ library.** It adds no code to device firmware. Instead it:
1. Registers a `sideload` PlatformIO build target that transfers data files to a connected device via Meshtastic's built-in XModem file transfer protocol
2. Ships the Meshtastic firmware patches that enable `/__ext__/` and `/__int__/` path routing in XModem (see `patches/`)

## Protocol

Frames are delimited by `0xBB` and coexist safely with Meshtastic's serial API (which uses `0x94C3`) and KISS framing (which uses `0xC0`).

```
Frame:    0xBB <cmd:1> <len:2 LE> <payload:len> <crc8:1>
Response: 0xBB 0x80 <status:1>   (0x00 = OK, 0x01 = ERR)

Commands:
  0x00  PING   payload=[]                          → OK + "MESHFORGE-SIDELOAD:0.1\n"
  0x01  OPEN   payload=[pathLen:1][path][size:4 LE]
  0x02  DATA   payload=[bytes, max 256]
  0x03  CLOSE  payload=[]
  0x04  MKDIR  payload=[path]
```

## Path routing

| Destination prefix | nRF52 | ESP32 |
|--------------------|-------|-------|
| `/ext/foo` | External QSPI LittleFS | LittleFS (prefix stripped) |
| `/int/foo` | InternalFS | LittleFS (prefix stripped) |
| `/foo` (bare) | InternalFS | LittleFS |

On ESP32 both prefixes are equivalent — the device has one filesystem. The prefix convention lets `meshforge.yaml` use a single universal path (e.g. `/ext/bbs/kb`) that works correctly on both platforms.

## Installation

```ini
; platformio.ini
[env:your_target]
lib_deps =
    meshenvy/meshforge-sideload@^0.1.0
```

## Meshtastic integration

The library has no dependency on Meshtastic. Integrate it by calling `begin()` from your module's `setup()` and `poll()` from `runOnce()`.

### 1. Add the library

```ini
lib_deps =
    meshenvy/meshforge-sideload@^0.1.0
```

### 2. Override the external FS (nRF52 only)

By default `/ext/` paths fall back to `InternalFS`. If your firmware has an external QSPI LittleFS, override the weak function anywhere in your source:

```cpp
// In your module .cpp, after including your QSPI flash header:
#if defined(MFSL_PLATFORM_NRF52)
Adafruit_LittleFS_Namespace::Adafruit_LittleFS& meshforgeSideloadExtFS() {
    return myQspiFs;   // your Adafruit_LittleFS instance, already mounted
}
#endif
```

The library never calls `begin()` on this FS — mount it before calling `MeshForgeSideload::begin()`.

### 3. Wire into your module

```cpp
#include "MeshForgeSideload.h"

static MeshForgeSideload meshForgeSideload;

void YourModule::setup() {
    // ... your existing setup ...
    meshForgeSideload.begin();
}

int32_t YourModule::runOnce() {
    meshForgeSideload.poll();
    // ... your existing logic ...
    return interval;
}
```

`poll()` is non-blocking and returns immediately when no `0xBB` frame is present on Serial.

### 4. Declare data files in meshforge.yaml

Add a `meshforge.yaml` to your firmware repo root:

```yaml
meshforge:
  data:
    - my-data/*.bin:/ext/my/path
```

The MeshForge CI bundler includes these files in the firmware `.tar.gz`. The MeshForge web flasher reads the yaml from the bundle, waits for the device to boot after flashing, and sideloads the files automatically.

## MeshCore

The library is firmware-agnostic — it depends only on the Arduino `Serial` object and standard Adafruit nRF52 BSP / ESP-IDF Arduino filesystem APIs. MeshCore runs on the same Adafruit nRF52 BSP, so the integration should work identically: override `meshforgeSideloadExtFS()` if needed and call `poll()` from your main loop. Formal MeshCore testing has not been done yet.

## Platforms

| Platform | Support |
|----------|---------|
| nRF52840 (Adafruit BSP) | Supported — InternalFS + optional QSPI ext FS |
| ESP32 / ESP32-S3 | Supported — LittleFS |
| Other Arduino targets | Compile-time no-op with `#pragma message` warning |

## License

MIT — see [LICENSE](LICENSE).
