/** Small browser helpers shared by the editor shell. */

export function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Writes text to the clipboard, also where the async clipboard API is unavailable (plain http). */
export function writeClipboard(text: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement("textarea")
  area.value = text
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  document.execCommand("copy")
  area.remove()
}

export function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
}

/** The modifier key's symbol for shortcut hints. */
export const MOD = typeof navigator !== "undefined" && isMac() ? "⌘" : "Ctrl"

export function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
