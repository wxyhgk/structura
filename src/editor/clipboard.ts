import { failure, writeClipboard } from "@/editor/browser"
import { writeImage } from "@/editor/clipboardImage"
import { pictureSvg } from "@/editor/pictureSvg"
import type { EditorState } from "@/editor/useEditor"

/**
 * Copy and cut put the selection on the clipboard as molfile text: `onEvent` answers the
 * browser's ⌘C / ⌘X, and `copy` / `cut` serve the Edit menu, where the menu itself would
 * block the copy event. `copyImage` puts a picture of the selection (or of the whole
 * drawing) there instead, and tells `report` when the browser refuses.
 */
export function selectionClipboard(
  editor: Pick<EditorState, "selectionMolfile" | "removeSelection" | "latest" | "selection" | "colorHetero">,
  report: (line: string) => void,
) {
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
    copyImage() {
      const svg = pictureSvg(editor.latest(), editor.selection, editor.colorHetero)
      if (svg) writeImage(svg).catch((error) => report(`图片没有放进剪贴板：${failure(error)}`))
    },
  }
}
