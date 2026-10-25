// A document carried from one of the app's pages to the other, opened in a new tab: the
// drawing page's 通式与批量生成 to the 通式 page, a generated compound back to the drawing page.
// It waits in this browser's storage under a key in the new page's address, which takes it
// once. Without storage it cannot travel; the page opens empty and says so.

const PREFIX = "structura:handoff:"

/** Opens `page` (e.g. "/markush.html") in a new tab with this document to start from. */
export function openWith(page: string, document: string) {
  const id = crypto.randomUUID()
  try {
    localStorage.setItem(PREFIX + id, document)
  } catch {
    window.open(page, "_blank")
    return
  }
  window.open(`${page}#from=${id}`, "_blank")
}

/** The document this page was opened with, taken (so a reload starts from the page's own copy), or null. */
export function takeHandoff(): string | null {
  const id = /^#from=([\w-]+)$/.exec(location.hash)?.[1]
  if (!id) return null
  history.replaceState(null, "", location.pathname + location.search)
  try {
    const document = localStorage.getItem(PREFIX + id)
    localStorage.removeItem(PREFIX + id)
    return document
  } catch {
    return null
  }
}
