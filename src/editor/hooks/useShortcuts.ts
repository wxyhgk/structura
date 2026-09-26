import { useEffect, type RefObject } from "react"
import { shortcutToElement } from "@/chem/elements/index"
import type { CanvasHandle } from "@/editor/Canvas"
import type { Commands } from "@/editor/hooks/useCommands"
import { editorKeysBlocked } from "@/editor/keys"
import { toolForKey } from "@/editor/tools/keys"
import type { EditorState } from "@/editor/useEditor"

type Direction = "left" | "right" | "up" | "down"

function arrowDirection(key: string): Direction | null {
  if (key === "ArrowLeft") return "left"
  if (key === "ArrowRight") return "right"
  if (key === "ArrowUp") return "up"
  if (key === "ArrowDown") return "down"
  return null
}

/**
 * Keys that act on the whole editor. Keys pressed while hovering an atom or bond are
 * the canvas's hover hotkeys and never reach here.
 */
export function useShortcuts(editor: EditorState, canvas: RefObject<CanvasHandle | null>, commands: Commands) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editorKeysBlocked(event)) return
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const run = (command: { run: () => void }) => {
        event.preventDefault()
        command.run()
      }
      if (meta) {
        if (key === "z") return run(event.shiftKey ? commands.redo : commands.undo)
        if (key === "y") return run(commands.redo)
        if (key === "a") return run(commands.selectAll)
        if (key === "n") return run(commands.newDocument)
        if (key === "d") return run(commands.duplicate)
        if (key === "o") return run(commands.open)
        if (event.key === "=" || event.key === "+") return run(commands.zoomIn)
        if (event.key === "-") return run(commands.zoomOut)
        if (event.key === "0") return run(commands.actualSize)
      }
      if (event.key === "Escape") {
        if (canvas.current?.hasGesture()) canvas.current.cancelGesture()
        else editor.setTool("lasso")
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") return run(commands.remove)
      const arrow = arrowDirection(event.key)
      if (arrow && (meta || event.altKey || event.shiftKey)) {
        event.preventDefault()
        if (meta) editor.addArrow(arrow)
        else if (event.shiftKey && event.altKey) editor.tumbleSelection(arrow)
        else if (event.altKey) editor.rotateSelection(arrow === "left" || arrow === "up" ? Math.PI / 12 : -Math.PI / 12)
        else editor.nudgeSelection(arrow)
        return
      }
      if (event.key === "Enter" && !canvas.current?.hotspot()) {
        const id = editor.selectionHotspot()
        if (id != null) {
          event.preventDefault()
          canvas.current?.focusAtom(id)
          return
        }
      }
      if (meta || event.altKey) return
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
      } else if ((event.key === "+" || event.key === "=") && editor.selection.atoms.length > 0) editor.applyCharge(1)
      else if (event.key === "-" && editor.selection.atoms.length > 0) editor.applyCharge(-1)
      else {
        const symbol = shortcutToElement(key)
        if (symbol) editor.applyElement(symbol)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editor, canvas, commands])
}
