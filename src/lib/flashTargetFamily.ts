import type { FlashManifest, FlashTargetFamily } from "./untarGz"

const KNOWN: readonly FlashTargetFamily[] = ["esp32", "esp8266", "nrf52", "rp2040", "unknown"]

function coerceTargetFamily(v: unknown): FlashTargetFamily | undefined {
  if (typeof v !== "string") return undefined
  return KNOWN.includes(v as FlashTargetFamily) ? (v as FlashTargetFamily) : undefined
}

/** Heuristic when manifest lacks targetFamily (older bundles). */
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
 * Prefer manifest.targetFamily from CI; else env-name heuristic; else esp32 for legacy ESP-only bundles.
 */
export function resolveFlashTargetFamily(
  manifest: FlashManifest | null,
  targetEnv: string | null | undefined
): FlashTargetFamily {
  const fromManifest = coerceTargetFamily(manifest?.targetFamily)
  if (fromManifest && fromManifest !== "unknown") {
    return fromManifest
  }
  const fromEnv = inferTargetFamilyFromEnv(targetEnv ?? null)
  if (fromEnv) {
    return fromEnv
  }
  if (fromManifest === "unknown") {
    return "unknown"
  }
  return "esp32"
}
