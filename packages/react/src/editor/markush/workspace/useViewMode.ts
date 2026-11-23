import { useState } from "react"

const KEY = "structura.resultsView"

/** How the results are shown: as cards or as a table. */
export type ViewMode = "cards" | "table"

function load(): ViewMode {
  try {
    return localStorage.getItem(KEY) === "table" ? "table" : "cards"
  } catch {
    return "cards"
  }
}

/** The view of the results, remembered in this browser. */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState(load)
  return [
    mode,
    (next) => {
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // Storage may be blocked; the choice lasts this visit.
      }
      setMode(next)
    },
  ]
}
