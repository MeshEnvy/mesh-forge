import type { FlashTargetFamily } from "./untarGz"


/** Heuristic when bundle file types are ambiguous (e.g. UF2 shared by nRF52 and RP2040). */
export function inferTargetFamilyFromEnv(env: string | null | undefined): FlashTargetFamily | null {
  if (!env?.trim()) return null
  const e = env.toLowerCase()
  if (/nrf|rak4631|rak2560|t-echo|wio|tracker-t|canaryone|meshlink|mesh-tab|wm1110|sensecap|nrf52840|nrf52/i.test(e)) {
    return "nrf52"
  }
  if (/esp8266|8266|d1_mini|nodemcu/i.test(e)) {
    return "esp8266"
  }
  if (/rp2040|pico|challenger_2040|picow|rak11310/i.test(e)) {
    return "rp2040"
  }
  if (/esp32|tlora|tbeam|heltec|challenger|station|s3|c3|hru|ebyte|nibble|nano-g1|radiomaster|m5stack|ai-c3/i.test(e)) {
    return "esp32"
  }
  return null
}

/**
 * Derive target family and erase capability from the files in a firmware bundle.
 *
 * Rules (in priority order):
 *   *.factory.bin present           → esp32  (always supports chip erase)
 *   firmware.dat present            → nrf52 Nordic DFU  (always supports erase)
 *   *.uf2 present (not nuke.uf2)    → nrf52 or rp2040 (use env name to disambiguate)
 *
 * canErase:
 *   esp32       → always true
 *   nrf52 DFU   → always true
 *   nrf52 UF2   → true only when nuke.uf2 is also in the bundle
 */
export function inferTargetFamilyFromBundle(
  files: Map<string, Uint8Array>,
  targetEnv?: string | null
): { family: FlashTargetFamily; canErase: boolean } {
  let hasUf2 = false
  let hasNukeUf2 = false

  for (const path of files.keys()) {
    const base = path.replace(/^.*\//, "").toLowerCase()
    if (base.endsWith(".factory.bin")) return { family: "esp32", canErase: true }
    if (base === "firmware.dat") return { family: "nrf52", canErase: true }
    if (base === "nuke.uf2") hasNukeUf2 = true
    else if (base.endsWith(".uf2")) hasUf2 = true
  }

  if (hasUf2) {
    const family = inferTargetFamilyFromEnv(targetEnv) ?? "nrf52"
    return { family, canErase: hasNukeUf2 }
  }

  // No clear signal — fall back to env name heuristic or default to esp32.
  const family = inferTargetFamilyFromEnv(targetEnv) ?? "esp32"
  return { family, canErase: family === "esp32" }
}
