import { TARGETS } from "@/constants/targets"
import { useEffect, useState } from "react"

type TargetGroup = (typeof TARGETS)[string] & { id: string }

const GROUPED_TARGETS = Object.entries(TARGETS).reduce(
  (acc, [id, meta]) => {
    const category = meta.category || "Other"
    if (!acc[category]) acc[category] = []
    acc[category].push({ id, ...meta })
    return acc
  },
  {} as Record<string, TargetGroup[]>
)

const TARGET_CATEGORIES = Object.keys(GROUPED_TARGETS).sort((a, b) => a.localeCompare(b))

const DEFAULT_TARGET =
  TARGET_CATEGORIES.length > 0 && GROUPED_TARGETS[TARGET_CATEGORIES[0]]?.length
    ? GROUPED_TARGETS[TARGET_CATEGORIES[0]][0].id
    : ""

const STORAGE_KEY = "quick_build_target"
const getStorageKeyForCategory = (category: string) => `quick_build_target_${category}`

export function useTargetSelection(
  compatibleTargets: Set<string> | null,
  filteredGroupedTargets: Record<string, TargetGroup[]>,
  filteredTargetCategories: string[]
) {
  const [activeCategory, setActiveCategory] = useState<string>(TARGET_CATEGORIES[0] ?? "")
  const [selectedTarget, setSelectedTarget] = useState<string>(DEFAULT_TARGET)

  const persistTargetSelection = (targetId: string, category?: string) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, targetId)
      if (category) {
        window.localStorage.setItem(getStorageKeyForCategory(category), targetId)
      }
    } catch (error) {
      console.error("Failed to persist target selection", error)
    }
  }

  const getSavedTargetForCategory = (category: string): string | null => {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(getStorageKeyForCategory(category))
    } catch (error) {
      console.error("Failed to read saved target for category", error)
      return null
    }
  }

  const handleSelectTarget = (targetId: string) => {
    if (compatibleTargets) {
      const normalizedId = targetId.replace(/[-_]/g, "")
      const isCompatible = compatibleTargets.has(targetId) || compatibleTargets.has(normalizedId)
      if (!isCompatible) {
        return
      }
    }
    setSelectedTarget(targetId)
    const category = TARGETS[targetId]?.category || "Other"
    persistTargetSelection(targetId, category)
    if (category && TARGET_CATEGORIES.includes(category)) {
      setActiveCategory(category)
    }
  }

  // Initialize active category
  useEffect(() => {
    const categories = compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0])
    }
  }, [activeCategory, compatibleTargets, filteredTargetCategories])

  // Handle category change - auto-select target
  useEffect(() => {
    if (activeCategory) {
      const targets = compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS
      const categoryTargets = targets[activeCategory] || []

      if (categoryTargets.length === 0) return

      const isCurrentTargetInCategory = categoryTargets.some(t => t.id === selectedTarget)

      if (!isCurrentTargetInCategory) {
        const savedTargetForCategory = getSavedTargetForCategory(activeCategory)
        const isValidSavedTarget = savedTargetForCategory && categoryTargets.some(t => t.id === savedTargetForCategory)

        if (isValidSavedTarget) {
          setSelectedTarget(savedTargetForCategory)
          persistTargetSelection(savedTargetForCategory, activeCategory)
        } else {
          const firstTarget = categoryTargets[0].id
          setSelectedTarget(firstTarget)
          persistTargetSelection(firstTarget, activeCategory)
        }
      }
    }
  }, [activeCategory, compatibleTargets, filteredGroupedTargets, selectedTarget])

  // Restore saved target on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const targets = compatibleTargets ? filteredGroupedTargets : GROUPED_TARGETS
      const categories = compatibleTargets ? filteredTargetCategories : TARGET_CATEGORIES

      if (categories.length === 0) return

      const savedTarget = localStorage.getItem(STORAGE_KEY)
      if (savedTarget && TARGETS[savedTarget]) {
        const isCompatible = Object.values(targets).some(categoryTargets =>
          categoryTargets.some(target => target.id === savedTarget)
        )

        if (isCompatible) {
          const category = TARGETS[savedTarget].category || "Other"
          if (categories.includes(category)) {
            setActiveCategory(category)
            setSelectedTarget(savedTarget)
            persistTargetSelection(savedTarget, category)
            return
          }
        }
      }

      const firstCategory = categories[0]
      const categoryTargets = targets[firstCategory] || []

      if (categoryTargets.length > 0) {
        const savedTargetForCategory = getSavedTargetForCategory(firstCategory)
        const isValidSavedTarget = savedTargetForCategory && categoryTargets.some(t => t.id === savedTargetForCategory)

        if (isValidSavedTarget) {
          setActiveCategory(firstCategory)
          setSelectedTarget(savedTargetForCategory)
          persistTargetSelection(savedTargetForCategory, firstCategory)
        } else {
          const firstTarget = categoryTargets[0].id
          setActiveCategory(firstCategory)
          setSelectedTarget(firstTarget)
          persistTargetSelection(firstTarget, firstCategory)
        }
      }
    } catch (error) {
      console.error("Failed to read saved target", error)
    }
  }, [compatibleTargets, filteredGroupedTargets, filteredTargetCategories])

  // Update selected target if it becomes incompatible
  useEffect(() => {
    if (!selectedTarget || !compatibleTargets) return

    const normalizedId = selectedTarget.replace(/[-_]/g, "")
    const isCompatible = compatibleTargets.has(selectedTarget) || compatibleTargets.has(normalizedId)

    if (!isCompatible) {
      const targets = filteredGroupedTargets
      const categories = filteredTargetCategories

      if (categories.length > 0) {
        const currentCategory = TARGETS[selectedTarget]?.category
        if (currentCategory && targets[currentCategory] && targets[currentCategory].length > 0) {
          const savedTargetForCategory = getSavedTargetForCategory(currentCategory)
          const isValidSavedTarget =
            savedTargetForCategory && targets[currentCategory].some(t => t.id === savedTargetForCategory)

          if (isValidSavedTarget) {
            setSelectedTarget(savedTargetForCategory)
            persistTargetSelection(savedTargetForCategory, currentCategory)
            return
          }

          setSelectedTarget(targets[currentCategory][0].id)
          persistTargetSelection(targets[currentCategory][0].id, currentCategory)
          return
        }

        const firstCategory = categories[0]
        const firstTarget = targets[firstCategory]?.[0]?.id
        if (firstTarget) {
          setSelectedTarget(firstTarget)
          setActiveCategory(firstCategory)
          persistTargetSelection(firstTarget, firstCategory)
        }
      }
    }
  }, [compatibleTargets, filteredGroupedTargets, filteredTargetCategories, selectedTarget])

  // Initialize storage
  useEffect(() => {
    if (typeof window === "undefined" || !selectedTarget) return
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, selectedTarget)
      }
    } catch (error) {
      console.error("Failed to initialize target storage", error)
    }
  }, [selectedTarget])

  return {
    activeCategory,
    selectedTarget,
    setActiveCategory,
    handleSelectTarget,
    GROUPED_TARGETS: GROUPED_TARGETS as Record<string, TargetGroup[]>,
    TARGET_CATEGORIES,
  }
}
