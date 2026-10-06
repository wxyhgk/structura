// The standalone app's safety net: while a drawing has unsaved changes, a copy is kept in
// this browser, so a reload or a closed tab loses nothing. Storage can be missing or full
// (private windows, blocked site data); then there is simply no copy.

const KEY = "structura:unsaved"

/** The copy kept from last time, and when it was taken. */
export type Unsaved = { document: string; at: number }

export function readUnsaved(): Unsaved | null {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return null
    const value = JSON.parse(text) as Unsaved
    return typeof value?.document === "string" && typeof value.at === "number" ? value : null
  } catch {
    return null
  }
}

export function keepUnsaved(document: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ document, at: Date.now() } satisfies Unsaved))
  } catch {
    // No room or no storage: nothing to keep it in.
  }
}

export function forgetUnsaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored, or storage is blocked.
  }
}
