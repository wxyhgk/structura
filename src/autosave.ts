// The standalone app's safety net: while a drawing has unsaved changes, a copy is kept in
// this browser, so a reload or a closed tab loses nothing. Storage can be missing or full
// (private windows, blocked site data); then there is simply no copy. Each page keeps its own
// (`key`): the drawing page's and the 通式 page's are different documents.

/** The drawing page's copy; the 通式 page keeps its own. */
export const DRAWING = "structura:unsaved"
export const MARKUSH = "structura:markush:unsaved"

/** The copy kept from last time, and when it was taken. */
export type Unsaved = { document: string; at: number }

export function readUnsaved(key: string): Unsaved | null {
  try {
    const text = localStorage.getItem(key)
    if (!text) return null
    const value = JSON.parse(text) as Unsaved
    return typeof value?.document === "string" && typeof value.at === "number" ? value : null
  } catch {
    return null
  }
}

export function keepUnsaved(key: string, document: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ document, at: Date.now() } satisfies Unsaved))
  } catch {
    // No room or no storage: nothing to keep it in.
  }
}

export function forgetUnsaved(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing stored, or storage is blocked.
  }
}
