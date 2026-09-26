import { useEffect } from "react"
import { writeClipboard } from "@/editor/browser"
import { editorKeysBlocked } from "@/editor/keys"
import type { EditorState } from "@/editor/useEditor"

/**
 * ⌘C / ⌘X put the selection on the clipboard as molfile text; the returned functions do
 * the same for the Edit menu, where the menu itself would block the copy event.
 */
export function useClipboard(editor: EditorState) {
  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      if (editorKeysBlocked(event)) return
      const text = editor.selectionMolfile()
      if (!text) return
      event.preventDefault()
      event.clipboardData?.setData("text/plain", text)
      if (event.type === "cut") editor.removeSelection()
    }
    document.addEventListener("copy", onCopy)
    document.addEventListener("cut", onCopy)
    return () => {
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("cut", onCopy)
    }
  })

  return {
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
