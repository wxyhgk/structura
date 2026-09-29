import { writeClipboard } from "@/editor/browser"
import type { EditorState } from "@/editor/useEditor"

/**
 * Copy and cut put the selection on the clipboard as molfile text: `onEvent` answers the
 * browser's ⌘C / ⌘X, and `copy` / `cut` serve the Edit menu, where the menu itself would
 * block the copy event.
 */
export function selectionClipboard(editor: Pick<EditorState, "selectionMolfile" | "removeSelection">) {
  return {
    onEvent(event: ClipboardEvent) {
      const text = editor.selectionMolfile()
      if (!text) return
      event.preventDefault()
      event.clipboardData?.setData("text/plain", text)
      if (event.type === "cut") editor.removeSelection()
    },
    copy() {
      const text = editor.selectionMolfile()
      if (text) writeClipboard(text)
    },
    cut() {
      const text = editor.selectionMolfile()
      if (!text) return
      writeClipboard(text)
      editor.removeSelection()
    },
  }
}
