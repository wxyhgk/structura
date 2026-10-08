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

/** The clipboard's text, for the Edit menu's paste; throws when the browser will not give it. */
/**
 * Why the page cannot use the clipboard API at all, or null. Browsers keep it to secure
 * pages (https, localhost); a dev server opened by LAN address over http is not one.
 */
export function clipboardBlocked(): string | null {
  if (window.isSecureContext) return null
  return `当前地址 ${location.origin} 是 http，浏览器只在 https 或 localhost 下允许网页读写剪贴板。可以用 localhost 打开，或在 Edge 打开 edge://flags/#unsafely-treat-insecure-origin-as-secure，启用并填入 ${location.origin} 后重启浏览器。`
}

export async function readClipboard(): Promise<string> {
  if (!window.isSecureContext || !navigator.clipboard?.readText) throw new Error("clipboard unavailable")
  return navigator.clipboard.readText()
}

export function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent)
}

/** The modifier key's symbol for shortcut hints. */
export const MOD = typeof navigator !== "undefined" && isMac() ? "⌘" : "Ctrl"

export function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
