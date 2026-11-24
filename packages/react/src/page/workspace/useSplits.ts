import { useEffect, useState } from "react"

/** Where the workspace's two dividers sit, as fractions: the left column's width, and the top row's height. */
export type Splits = { left: number; top: number }

export const DEFAULT_SPLITS: Splits = { left: 0.56, top: 0.6 }
const KEY = "structura.workspaceSplits"
const LIMITS = { left: [0.3, 0.75], top: [0.3, 0.82] } as const

/** A fraction kept where both sides of a divider stay usable. */
export function clampSplit(which: keyof Splits, value: number): number {
  const [low, high] = LIMITS[which]
  return Math.min(high, Math.max(low, value))
}

function remembered(): Splits {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Splits> | null
    if (saved && typeof saved.left === "number" && typeof saved.top === "number") return { left: clampSplit("left", saved.left), top: clampSplit("top", saved.top) }
  } catch {
    // No storage (private window, blocked): the defaults do.
  }
  return DEFAULT_SPLITS
}

/** The dividers' places, remembered in this browser between visits. */
export function useSplits() {
  const [splits, setSplits] = useState<Splits>(remembered)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(splits))
    } catch {
      // Not remembered, still works.
    }
  }, [splits])
  return {
    splits,
    set: (which: keyof Splits, value: number) => setSplits((current) => ({ ...current, [which]: clampSplit(which, value) })),
    reset: (which: keyof Splits) => setSplits((current) => ({ ...current, [which]: DEFAULT_SPLITS[which] })),
  }
}
