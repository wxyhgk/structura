/** A key combination. `meta` means ⌘ on a Mac and Ctrl elsewhere. */
export type KeyMatch = { key: string; meta?: boolean; shift?: boolean; alt?: boolean }

type KeyEventLike = { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }

/**
 * Letters compare without case (Shift is checked separately); other keys compare exactly.
 * A match that does not ask for Shift ignores it for symbols like + that need Shift to type.
 */
export function matches(event: KeyEventLike, match: KeyMatch): boolean {
  const letter = /^[a-z]$/i.test(match.key)
  const sameKey = letter ? event.key.toLowerCase() === match.key.toLowerCase() : event.key === match.key
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
