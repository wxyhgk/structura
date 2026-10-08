import { useEffect } from "react"

/** Where the "raised variable numbers" choice is remembered in this browser. */
export const RAISED_NUMBERS = "structura:raised-numbers"

/**
 * A yes/no preference of the person using this browser, remembered across visits: read back
 * once at start, written whenever it is changed through the returned setter. Without
 * storage (private window, blocked site data) it simply starts from the default each time.
 */
export function useRememberedSetting(key: string, value: boolean, set: (value: boolean) => void): (value: boolean) => void {
  useEffect(() => {
    try {
      const kept = localStorage.getItem(key)
      if (kept != null && (kept === "1") !== value) set(kept === "1")
    } catch {
      // No storage: the default stands.
    }
    // Only at start: later changes come through the setter below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (next) => {
    set(next)
    try {
      localStorage.setItem(key, next ? "1" : "0")
    } catch {
      // No storage: it lasts this visit only.
    }
  }
}
