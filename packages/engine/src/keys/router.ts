import { shortcutToElement } from "@structura/core/elements"
import type { Command } from "../commands/command.ts"
import type { HoverTarget } from "../pointer/types.ts"
import type { Editor } from "../state/editor.ts"
import { toolForKey } from "../tools/bindings.ts"
import { keyOf, matches, type KeyEventLike } from "./keymap.ts"

/** A key press as the router needs it: which key, with which modifiers, and a way to keep it from the page. */
export type KeyEvent = KeyEventLike & { preventDefault(): void }

/** What a key can reach: the editor's actions, the canvas under the pointer (if any), and the commands. */
export type KeyRoutes = {
  editor: Pick<Editor, "get" | "hotkeySelection" | "applyBondOrder" | "setBondStyle" | "setRingKind" | "setTool" | "applyElement" | "takeBracketTool">
  canvas: { pointed(): HoverTarget; handleKey(event: KeyEvent): boolean; hasGesture(): boolean } | null
  commands: Command[]
}

/**
 * A key pressed while typing in a field: the field keeps it (⌘A, ⌘C, ⌘Z act on the text)
 * unless a command says it works anywhere, like ⌘S. Returns whether a command ran.
 */
export function routeFieldKey(event: KeyEvent, commands: Command[]): boolean {
  const command = commands.find((item) => item.inFields && item.enabled && item.keys.some((match) => matches(event, match)))
  if (!command) return false
  event.preventDefault()
  command.run()
  return true
}

/**
 * The one keyboard router, for a key the editor owns. Each key goes to the first of these
 * that uses it:
 * 1. the atom or bond under the pointer, as in ChemDraw; if the pointer is over part of the
 *    selection, the key acts on every selected atom (or bond) instead,
 * 2. with nothing under the pointer, the hotspot the last key left (the green circle),
 * 3. with neither, every selected atom (or bond),
 * 4. a command bound to the key,
 * 5. a tool key,
 * 6. an element key.
 */
export function routeKey(event: KeyEvent, { editor, canvas, commands }: KeyRoutes): void {
  const key = keyOf(event)
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey
  const pointed = canvas?.pointed() ?? null
  const { selection } = editor.get()
  const onSelection = pointed != null && (pointed.type === "atom" ? selection.atoms : selection.bonds).includes(pointed.id)
  const idle = plain && !canvas?.hasGesture()
  if (idle && onSelection && editor.hotkeySelection(key)) {
    event.preventDefault()
    return
  }
  // The pointer's atom or bond, else the hotspot the last key left.
  if (canvas?.handleKey(event)) {
    event.preventDefault()
    return
  }
  if (idle && editor.hotkeySelection(key)) {
    event.preventDefault()
    return
  }
  const command = commands.find(
    (item) => item.enabled && item.keys.some((match) => matches(event, match)) && (item.when?.() ?? true),
  )
  if (command) {
    event.preventDefault()
    command.run()
    return
  }
  // Arrows with a modifier belong to commands even when those are disabled right now.
  if (event.key.startsWith("Arrow") && (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)) {
    event.preventDefault()
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const toolKey = toolForKey(key)
  if (toolKey) {
    // 1/2/3 also set the order of selected bonds.
    if (/^[123]$/.test(toolKey.key)) editor.applyBondOrder(Number(toolKey.key) as 1 | 2 | 3)
    else if (toolKey.tool === "bond") {
      editor.setBondStyle(toolKey.style)
      editor.setTool("bond")
    } else if (toolKey.tool === "ring") {
      editor.setRingKind(toolKey.ring)
      editor.setTool("ring")
    } else if (toolKey.tool === "ring-current") editor.setTool("ring")
    else if (toolKey.tool === "bracket") editor.takeBracketTool()
    else editor.setTool(toolKey.tool)
    return
  }
  const symbol = shortcutToElement(key.toLowerCase())
  if (symbol) editor.applyElement(symbol)
}
