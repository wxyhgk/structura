// A document carried from one of the app's pages to the other, opened in a new tab: the
// drawing page's 通式与批量生成 to the 通式 page, a generated compound back to the drawing page.
// It waits in this browser's storage under a key in the new page's address, which takes it
// once. Without storage it cannot travel; the page opens empty and says so. One that nobody
// takes (the tab was blocked, or closed at once) is removed at once, or when it is a day old.

const PREFIX = "structura:handoff:"
/** How long a document waits to be taken, and how many wait at most. */
export const WAIT_MS = 24 * 60 * 60 * 1000
export const WAIT_COUNT = 5

type Waiting = { document: string; at: number }

function parse(text: string | null): Waiting | null {
  try {
    const value = JSON.parse(text ?? "") as Partial<Waiting>
    return typeof value?.document === "string" && typeof value.at === "number" ? (value as Waiting) : null
  } catch {
    return null
  }
}

/** Removes the documents that waited too long or beyond the newest WAIT_COUNT, and any that are not in this form. */
export function sweepHandoffs(store: Storage = localStorage, now = Date.now()) {
  const waiting: Array<{ key: string; at: number }> = []
  for (let index = store.length - 1; index >= 0; index--) {
    const key = store.key(index)
    if (!key?.startsWith(PREFIX)) continue
    const entry = parse(store.getItem(key))
    if (entry && now - entry.at <= WAIT_MS) waiting.push({ key, at: entry.at })
    else store.removeItem(key)
  }
  for (const { key } of waiting.sort((a, b) => b.at - a.at).slice(WAIT_COUNT)) store.removeItem(key)
}

/** Opens `page` (e.g. "/markush.html") in a new tab with this document to start from. */
export function openWith(page: string, document: string) {
  const id = crypto.randomUUID()
  try {
    sweepHandoffs()
    localStorage.setItem(PREFIX + id, JSON.stringify({ document, at: Date.now() } satisfies Waiting))
  } catch {
    window.open(page, "_blank")
    return
  }
  if (window.open(`${page}#from=${id}`, "_blank")) return
  // Blocked: nobody will take it.
  try {
    localStorage.removeItem(PREFIX + id)
  } catch {
    // Left for the sweep.
  }
  alert("浏览器拦截了新标签页。请允许本站打开弹出窗口，再试一次。")
}

/** The document this page was opened with, taken (so a reload starts from the page's own copy), or null. */
export function takeHandoff(): string | null {
  const id = /^#from=([\w-]+)$/.exec(location.hash)?.[1]
  if (!id) return null
  history.replaceState(null, "", location.pathname + location.search)
  try {
    const entry = parse(localStorage.getItem(PREFIX + id))
    localStorage.removeItem(PREFIX + id)
    sweepHandoffs()
    return entry?.document ?? null
  } catch {
    return null
  }
}
