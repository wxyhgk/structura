/** A key combination. `meta` means ⌘ on a Mac and Ctrl elsewhere. */
export type KeyMatch = { key: string; meta?: boolean; shift?: boolean; alt?: boolean }

export type KeyEventLike = { key: string; code?: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }

const CODE_KEYS: Record<string, [string, string]> = { Minus: ["-", "_"], Equal: ["=", "+"], BracketLeft: ["[", "{"], BracketRight: ["]", "}"] }

/**
 * The key as the shortcut tables spell it. When the browser does not report a plain
 * character (an input method answers "Process", a non-Latin layout gives "ф"), the
 * physical key decides instead, so shortcuts keep working with a Chinese input method on.
 */
export function keyOf(event: KeyEventLike): string {
  const key = event.key
  const printable = /^[\x21-\x7e]$/.test(key)
  const named = key.length > 1 && key !== "Process" && key !== "Unidentified"
  if (printable || named || !event.code) return key
  const code = event.code
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return event.shiftKey ? letter[1] : letter[1].toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)
  if (digit && !event.shiftKey) return digit[1]
  const symbol = CODE_KEYS[code]
  if (symbol) return symbol[event.shiftKey ? 1 : 0]
  return key
}

/**
 * Letters compare without case (Shift is checked separately); other keys compare exactly.
 * A match that does not ask for Shift ignores it for symbols like + that need Shift to type.
 */
export function matches(event: KeyEventLike, match: KeyMatch): boolean {
  const letter = /^[a-z]$/i.test(match.key)
  const key = keyOf(event)
  const sameKey = letter ? key.toLowerCase() === match.key.toLowerCase() : key === match.key
  if (!sameKey) return false
  if ((event.metaKey || event.ctrlKey) !== Boolean(match.meta)) return false
  if (event.altKey !== Boolean(match.alt)) return false
  if (letter || match.shift != null) return event.shiftKey === Boolean(match.shift)
  return true
}

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "Esc",
  Enter: "Enter",
  "-": "−",
}

/** "⇧⌘Z", "Ctrl+", "⌥←": how a combination is shown in menus and help. */
export function keyLabel(match: KeyMatch, mod: string): string {
  const name = KEY_NAMES[match.key] ?? (match.key.length === 1 ? match.key.toUpperCase() : match.key)
  return `${match.shift ? "⇧" : ""}${match.alt ? "⌥" : ""}${match.meta ? mod : ""}${name}`
}
