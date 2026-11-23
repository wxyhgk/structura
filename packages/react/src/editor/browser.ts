/** Small browser helpers shared by the editor shell. */

/** How long a download's object URL stays valid: some browsers start reading it after the click returns. */
const REVOKE_DELAY = 60_000

/** Starts a download of `url` as `filename`; the link is attached to the page for the click, which some browsers require. */
export function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY)
  }
}

export function download(filename: string, contents: string | Uint8Array<ArrayBuffer> | Blob, type: string) {
  downloadUrl(URL.createObjectURL(new Blob([contents], { type })), filename)
}

/**
 * Writes text to the clipboard, also where the async clipboard API is unavailable (plain http).
 * Resolves to whether the browser took it: callers say so when it did not, and a cut keeps the selection.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Denied (no focus, no permission): the selection-based copy below may still be allowed.
    }
  }
  const area = document.createElement("textarea")
  area.value = text
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  try {
    area.select()
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    area.remove()
  }
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
