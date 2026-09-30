import { useCallback, useRef, useState } from "react"
import { emptyHistory, historyReducer, type History, type HistoryAction } from "@/chem/history"
import type { Drawing, Molecule } from "@/chem/types"

/** A document that starts out holding these molecules, or this saved drawing, with nothing to undo. */
function startHistory(initial: Molecule[] | Drawing): History {
  const action: HistoryAction = Array.isArray(initial) ? { type: "open", molecules: initial } : { type: "load", drawing: initial }
  return { ...historyReducer(emptyHistory(), action), past: [] }
}

/**
 * The undo history, also readable outside rendering: `latest()` is the drawing as of the
 * last action even before React re-renders, so edits that arrive back to back (fast key
 * presses, an import landing mid-drag) build on each other instead of on an older render.
 */
export function useHistory(initial: Molecule[] | Drawing) {
  const [history, setHistory] = useState(() => startHistory(initial))
  const current = useRef(history)

  const dispatch = useCallback((action: HistoryAction) => {
    current.current = historyReducer(current.current, action)
    setHistory(current.current)
  }, [])

  const latest = useCallback((): Drawing => current.current.present, [])

  return { history, dispatch, latest }
}
