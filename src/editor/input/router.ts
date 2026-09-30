import { shortcutToElement } from "@/chem/elements/index"
import type { CanvasHandle } from "@/editor/canvas/types"
import { allCommands, type Commands } from "@/editor/hooks/useCommands"
import { keyOf, matches } from "@/editor/input/keymap"
import { toolForKey } from "@/editor/tools/bindings"
import type { EditorState } from "@/editor/useEditor"

export type KeyRoutes = {
  editor: Pick<EditorState, "hotkeySelection" | "applyBondOrder" | "setBondStyle" | "setRingKind" | "setTool" | "applyElement">
  canvas: CanvasHandle | null
  commands: Commands
}

/**
 * A key pressed while typing in a field: the field keeps it (⌘A, ⌘C, ⌘Z act on the text)
 * unless a command says it works anywhere, like ⌘S. Returns whether a command ran.
 */
export function routeFieldKey(event: KeyboardEvent, commands: Commands): boolean {
  const command = allCommands(commands).find((item) => item.inFields && item.enabled && item.keys.some((match) => matches(event, match)))
  if (!command) return false
  event.preventDefault()
  command.run()
  return true
}

/**
 * The one keyboard router, for a key the editor owns. Each key goes to the first of these
 * that uses it:
 * 1. the selection: a hover key acts on every selected atom (or bond),
 * 2. the canvas's hover hotkeys (the atom or bond under the pointer),
 * 3. a command bound to the key,
 * 4. a tool key,
 * 5. an element key.
 */
export function routeKey(event: KeyboardEvent, { editor, canvas, commands }: KeyRoutes): void {
  const key = keyOf(event)
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey
  if (plain && !canvas?.hasGesture() && editor.hotkeySelection(key)) {
    event.preventDefault()
    return
  }
  if (canvas?.handleKey(event)) {
    event.preventDefault()
    return
  }
  const command = allCommands(commands).find(
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
    else editor.setTool(toolKey.tool)
    return
  }
  const symbol = shortcutToElement(key.toLowerCase())
  if (symbol) editor.applyElement(symbol)
}
