import { useEffect, type RefObject } from "react"
import { shortcutToElement } from "@/chem/elements/index"
import type { CanvasHandle } from "@/editor/canvas/types"
import { allCommands, type Commands } from "@/editor/hooks/useCommands"
import { matches } from "@/editor/keymap"
import { editorKeysBlocked, inTextField } from "@/editor/keys"
import { toolForKey } from "@/editor/tools/keys"
import type { EditorState } from "@/editor/useEditor"

/**
 * The one keyboard router. Each key goes to the first of these that uses it:
 * 1. the selection: a hover key acts on every selected atom (or bond),
 * 2. the canvas's hover hotkeys (the atom or bond under the pointer),
 * 3. a command bound to the key,
 * 4. a tool key,
 * 5. an element key.
 */
export function useShortcuts(editor: EditorState, canvas: RefObject<CanvasHandle | null>, commands: Commands) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // ⌘A outside a text field never selects the page's text, even while a menu is open.
      if (matches(event, { key: "a", meta: true }) && !inTextField(event)) event.preventDefault()
      if (editorKeysBlocked(event)) return
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey
      if (plain && !canvas.current?.hasGesture() && editor.hotkeySelection(event.key)) {
        event.preventDefault()
        return
      }
      if (canvas.current?.handleKey(event)) {
        event.preventDefault()
        return
      }
      const command = allCommands(commands).find(
        (item) => item.enabled && item.keys.some((key) => matches(event, key)) && (item.when?.() ?? true),
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
      const toolKey = toolForKey(event.key)
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
      const symbol = shortcutToElement(event.key.toLowerCase())
      if (symbol) editor.applyElement(symbol)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editor, canvas, commands])
}
