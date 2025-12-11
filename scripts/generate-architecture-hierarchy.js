import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIRMWARE_DIR = path.resolve(__dirname, "../vendor/firmware")
const VARIANTS_DIR = path.join(FIRMWARE_DIR, "variants")
const OUTPUT_FILE = path.resolve(__dirname, "../constants/architecture-hierarchy.json")

/**
 * Parse PlatformIO ini file to extract sections and their properties
 */
function parseIniFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  const content = fs.readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  let currentSection = null
  const sections = {}

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith(";")) {
      continue
    }

    // Section header: [section_name]
    const sectionMatch = trimmed.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      sections[currentSection] = {}
      continue
    }

    // Key-value pairs
    if (currentSection && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=")
      const value = valueParts.join("=").trim()
      sections[currentSection][key.trim()] = value
    }
  }

  return sections
}

/**
 * Find all ini files recursively
 */
function findAllIniFiles() {
  const iniFiles = []

  if (!fs.existsSync(VARIANTS_DIR)) {
    console.error(`Variants directory not found: ${VARIANTS_DIR}`)
    process.exit(1)
  }

  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue
      }

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        scanDirectory(fullPath)
      } else if (entry.isFile() && entry.name.endsWith(".ini")) {
        iniFiles.push(fullPath)
      }
    }
  }

  scanDirectory(VARIANTS_DIR)
  // Also include the main platformio.ini
  const mainIni = path.join(FIRMWARE_DIR, "platformio.ini")
  if (fs.existsSync(mainIni)) {
    iniFiles.push(mainIni)
  }

  return iniFiles
}

/**
 * Extract architecture name from base section name
 */
function extractArchFromBaseSection(sectionName) {
  const match = sectionName.match(/^([a-z0-9]+)_base$/)
  if (!match) {
    return null
  }

  const arch = match[1]

  // Filter out non-architecture bases (library/feature bases)
  const nonArchitectureBases = [
    "arduino",
    "networking",
    "radiolib",
    "environmental",
    "device-ui",
    "native", // Ignore native architecture
  ]

  if (nonArchitectureBases.includes(arch)) {
    return null
  }

  // Filter out variant bases that extend other bases (not root architectures)
  // These are board-specific or variant-specific bases, not architecture bases
  // We'll detect this by checking if they extend another _base (handled in buildParentMapping)

  // Filter out board-specific bases
  const boardSpecificPatterns = [/heltec/i, /crowpanel/i, /mesh_tab/i, /muzi/i]

  for (const pattern of boardSpecificPatterns) {
    if (pattern.test(arch)) {
      return null
    }
  }

  // Architecture names typically don't have underscores (except for numbers)
  if (arch.includes("_") && !arch.match(/^[a-z]+\d+$/)) {
    return null
  }

  return arch
}

/**
 * Extract parent from extends directive
 * PlatformIO allows multiple extends separated by commas - take the first one
 */
function getParentFromExtends(extendsValue) {
  if (!extendsValue) {
    return null
  }

  // Handle comma-separated extends (take the first one)
  const firstExtends = extendsValue.split(",")[0].trim()

  // Remove env: prefix if present
  const cleaned = firstExtends.replace(/^env:/, "")

  // Check if it's an architecture base (e.g., "esp32_base")
  const archMatch = cleaned.match(/^([a-z0-9]+)_base$/)
  if (archMatch) {
    const parent = archMatch[1]
    if (parent === "arduino") {
      return null
    }
    return parent
  }

  // Otherwise return as-is (could be a variant base or another target)
  return cleaned
}

/**
 * Build flat parent mapping for all targets, variant bases, and architectures
 */
function buildParentMapping() {
  const allIniFiles = findAllIniFiles()

  // Track all parent relationships: child -> parent
  const parentMap = {}

  // Track all entities we've seen (targets, variant bases, architectures)
  const allEntities = new Set()

  // First pass: collect all [env:target] sections first (they take precedence)
  const targetNames = new Set()
  for (const iniFile of allIniFiles) {
    const sections = parseIniFile(iniFile)
    if (!sections) {
      continue
    }

    for (const [sectionName] of Object.entries(sections)) {
      const envMatch = sectionName.match(/^env:(.+)$/)
      if (envMatch) {
        targetNames.add(envMatch[1])
      }
    }
  }

  // Second pass: collect all relationships
  for (const iniFile of allIniFiles) {
    const sections = parseIniFile(iniFile)
    if (!sections) {
      continue
    }

    for (const [sectionName, sectionData] of Object.entries(sections)) {
      const extendsValue = sectionData.extends
      if (!extendsValue) {
        continue
      }

      // Handle [env:target] sections
      const envMatch = sectionName.match(/^env:(.+)$/)
      if (envMatch) {
        const targetName = envMatch[1]
        allEntities.add(targetName)
        const parent = getParentFromExtends(extendsValue)
        if (parent) {
          parentMap[targetName] = parent
          allEntities.add(parent)
        }
        continue
      }

      // Handle [variant_base] sections (variant-specific bases like heltec_v4_base)
      const variantBaseMatch = sectionName.match(/^(.+)_base$/)
      if (variantBaseMatch) {
        const variantBaseName = sectionName // Keep full name like "heltec_v4_base"
        allEntities.add(variantBaseName)
        const parent = getParentFromExtends(extendsValue)
        if (parent) {
          parentMap[variantBaseName] = parent
          allEntities.add(parent)
        }
        continue
      }

      // Handle [arch_base] sections (architecture bases)
      // Only treat as architecture base if it doesn't extend another _base (those are variant bases)
      const arch = extractArchFromBaseSection(sectionName)
      if (arch) {
        // Check if this extends another _base - if so, it's a variant base, not an architecture base
        const parentMatch = extendsValue.match(/([a-z0-9]+)_base/)
        if (parentMatch && parentMatch[1] !== "arduino") {
          // This extends another _base, so it's a variant base, not an architecture base
          // Treat it as a variant base instead
          const variantBaseName = sectionName
          allEntities.add(variantBaseName)
          const parent = getParentFromExtends(extendsValue)
          if (parent) {
            parentMap[variantBaseName] = parent
            allEntities.add(parent)
          }
          continue
        }

        // This is a true architecture base
        const archBaseName = `${arch}_base`
        allEntities.add(archBaseName)
        const parent = getParentFromExtends(extendsValue)
        if (parent) {
          parentMap[archBaseName] = parent
          allEntities.add(parent)
        }
        // Also add the architecture itself (without _base suffix)
        // Only if it doesn't conflict with an existing target name
        if (!targetNames.has(arch)) {
          allEntities.add(arch)
          parentMap[arch] = archBaseName
        }
        continue
      }
    }
  }

  // Second pass: resolve architecture base names to architecture names
  // Build a mapping of architecture bases to their parent architectures
  const archBaseToArch = {}
  const archToParentArch = {}

  // First, map architecture bases to their parent architectures
  for (const [child, parent] of Object.entries(parentMap)) {
    if (child.endsWith("_base")) {
      const archMatch = child.match(/^([a-z0-9]+)_base$/)
      if (archMatch) {
        const arch = archMatch[1]
        const isArchitecture = extractArchFromBaseSection(child) !== null
        if (isArchitecture) {
          archBaseToArch[child] = arch
          // The parent of an architecture base is the parent architecture
          if (parent) {
            archToParentArch[arch] = parent
          }
        }
      }
    }
  }

  // Third pass: resolve all parent references
  // Replace architecture base references with architecture references
  const resolvedParentMap = {}

  for (const [child, parent] of Object.entries(parentMap)) {
    if (!parent) {
      resolvedParentMap[child] = null
      continue
    }

    // If parent is an architecture base, resolve to architecture
    if (archBaseToArch[parent]) {
      resolvedParentMap[child] = archBaseToArch[parent]
    } else {
      resolvedParentMap[child] = parent
    }
  }

  // Add architecture entries themselves (pointing to their parent architecture)
  for (const [arch, parentArch] of Object.entries(archToParentArch)) {
    if (!resolvedParentMap[arch]) {
      resolvedParentMap[arch] = parentArch
    }
  }

  // Mark base architectures (those with no parent) as null
  const baseArchitectures = ["esp32", "nrf52", "rp2040", "rp2350", "stm32", "portduino"]
  for (const baseArch of baseArchitectures) {
    if (allEntities.has(baseArch)) {
      // If it doesn't have a parent or parent resolves to null, it's a base
      if (!resolvedParentMap[baseArch]) {
        resolvedParentMap[baseArch] = null
      }
    }
  }

  // Remove native entries (ignore native architecture)
  const keysToRemove = Object.keys(resolvedParentMap).filter(k => k === "native" || k.startsWith("native"))
  for (const key of keysToRemove) {
    delete resolvedParentMap[key]
  }

  // Return map with actual PlatformIO environment names (no normalization)
  return resolvedParentMap
}

/**
 * Validate parent mapping for conflicts and issues
 */
function validateParentMapping(parentMap) {
  const errors = []
  const warnings = []

  // Check for duplicate keys (shouldn't happen, but verify)
  const keys = Object.keys(parentMap)
  const keySet = new Set(keys)
  if (keys.length !== keySet.size) {
    errors.push("Duplicate keys found in mapping")
  }

  // Check for self-references (child pointing to itself)
  for (const [child, parent] of Object.entries(parentMap)) {
    if (parent === child) {
      errors.push(`Self-reference detected: "${child}" points to itself`)
    }
  }

  // Check for circular references
  for (const key of keys) {
    const visited = new Set()
    let current = key
    let depth = 0
    const maxDepth = 100 // Safety limit

    while (current && parentMap[current] !== null && parentMap[current] !== undefined) {
      if (visited.has(current)) {
        errors.push(`Circular reference detected involving "${current}"`)
        break
      }
      visited.add(current)
      current = parentMap[current]
      depth++
      if (depth > maxDepth) {
        errors.push(`Infinite loop detected starting from "${key}"`)
        break
      }
    }
  }

  // Check for missing parent references
  for (const [child, parent] of Object.entries(parentMap)) {
    if (parent !== null && parent !== undefined && !parentMap.hasOwnProperty(parent)) {
      warnings.push(`"${child}" references missing parent "${parent}"`)
    }
  }

  if (errors.length > 0) {
    console.error("\nVALIDATION ERRORS:")
    errors.forEach(err => console.error(`  ERROR: ${err}`))
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.warn("\nVALIDATION WARNINGS:")
    warnings.forEach(warn => console.warn(`  WARNING: ${warn}`))
  }

  console.log(`✓ Validation passed: ${keys.length} entries, no conflicts`)
}

/**
 * Generate JSON file
 */
function generateFile(parentMap) {
  validateParentMapping(parentMap)
  const content = JSON.stringify(parentMap, null, 2)
  fs.writeFileSync(OUTPUT_FILE, content)
  const count = Object.keys(parentMap).length
  console.log(`Generated ${OUTPUT_FILE} with ${count} entries`)
}

const parentMap = buildParentMapping()
generateFile(parentMap)
