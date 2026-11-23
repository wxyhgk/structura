// The standalone app's safety net: while a drawing has unsaved changes, a copy is kept in
// this browser, so a reload or a closed tab loses nothing. Storage can be missing or full
// (private windows, blocked site data); then there is simply no copy, and the page says so
// once. Each page keeps its own (`prefix`): the drawing page's and the 通式 page's are
// different documents. And each open page keeps its own copy under the prefix, so two tabs
// never write over each other; what the next visit is offered is the newest copy another
// page left. Copies older than a week, and all but the newest few, are cleared.

/** The drawing page's copies; the 通式 page keeps its own. */
export const DRAWING = "structura:unsaved"
export const MARKUSH = "structura:markush:unsaved"

/** How long a copy is worth offering back. */
export const KEEP_MS = 7 * 24 * 60 * 60 * 1000
/** How many copies of other pages are kept; the oldest go first. */
export const KEEP_COPIES = 5

/** Names this page's copy: new each time the page loads, so a reload finds what the page before it left. */
const PAGE = Math.random().toString(36).slice(2, 10)

/** A copy kept from earlier, when it was taken, and the storage key it is under (to forget it). */
export type Unsaved = { document: string; at: number; key: string }

/** Every copy under `prefix`, the one this page wrote included; the old single-copy key counts as one. */
function copies(store: Storage, prefix: string): Unsaved[] {
  const found: Unsaved[] = []
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (key !== prefix && !key?.startsWith(`${prefix}:`)) continue
    try {
      const value = JSON.parse(store.getItem(key) ?? "") as { document?: unknown; at?: unknown }
      if (typeof value?.document === "string" && typeof value.at === "number") found.push({ document: value.document, at: value.at, key })
    } catch {
      // Not a copy of ours: left alone.
    }
  }
  return found
}

/** Takes away copies that are too old, and the oldest of the rest beyond KEEP_COPIES (this page's own is never among them). */
function sweep(store: Storage, prefix: string, now: number) {
  const own = `${prefix}:${PAGE}`
  const others = copies(store, prefix).filter((copy) => copy.key !== own)
  const fresh = others.filter((copy) => now - copy.at <= KEEP_MS).sort((a, b) => b.at - a.at)
  for (const copy of others) if (!fresh.includes(copy) || fresh.indexOf(copy) >= KEEP_COPIES) store.removeItem(copy.key)
}

/** The newest copy an earlier page left (not this page's own), if it is not too old. */
export function readUnsaved(prefix: string): Unsaved | null {
  try {
    const own = `${prefix}:${PAGE}`
    const now = Date.now()
    sweep(localStorage, prefix, now)
    return copies(localStorage, prefix).filter((copy) => copy.key !== own).sort((a, b) => b.at - a.at)[0] ?? null
  } catch {
    return null
  }
}

/** Keeps this page's copy; false when it could not be kept (no room, or no storage). */
export function keepUnsaved(prefix: string, document: string): boolean {
  const key = `${prefix}:${PAGE}`
  const write = () => localStorage.setItem(key, JSON.stringify({ document, at: Date.now() } satisfies Omit<Unsaved, "key">))
  try {
    write()
    return true
  } catch {
    // Full: other pages' copies make room, oldest first, before giving up.
    try {
      for (const copy of copies(localStorage, prefix).filter((other) => other.key !== key).sort((a, b) => a.at - b.at)) {
        localStorage.removeItem(copy.key)
        try {
          write()
          return true
        } catch {
          // Still no room: the next one goes.
        }
      }
    } catch {
      // Storage is blocked.
    }
    return false
  }
}

/** Drops a copy that was offered back (restored or discarded), or this page's own (the drawing was saved). */
export function forgetUnsaved(prefix: string, copy?: Unsaved) {
  try {
    localStorage.removeItem(copy?.key ?? `${prefix}:${PAGE}`)
  } catch {
    // Nothing stored, or storage is blocked.
  }
}
