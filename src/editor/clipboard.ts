import { failure, writeClipboard } from "@/editor/browser"
import { downloadImage, writeImage } from "@/editor/clipboardImage"
import { drawOptions } from "@/editor/drawOptions"
import { pictureSvg } from "@/editor/pictureSvg"
import type { EditorState } from "@/editor/useEditor"

/**
 * Copy and cut put the selection on the clipboard as molfile text: `onEvent` answers the
 * browser's ⌘C / ⌘X, and `copy` / `cut` serve the Edit menu, where the menu itself would
 * block the copy event. `copyImage` puts a picture of the selection (or of the whole
 * drawing) there instead, and tells `report` when the browser refuses.
 */
export function selectionClipboard(
  editor: Pick<EditorState, "selectionMolfile" | "removeSelection" | "latest" | "selection" | "colorHetero" | "raisedNumbers">,
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
      const svg = pictureSvg(editor.latest(), editor.selection, editor.colorHetero, drawOptions(editor.raisedNumbers))
      // Where the clipboard refuses, the picture is still worth having: it is downloaded instead.
      if (svg)
        writeImage(svg).catch((error) =>
          downloadImage(svg).then(
            () => report(`图片没有放进剪贴板，已改为下载“结构.png”。原因：${failure(error)}`),
            () => report(`图片没有放进剪贴板：${failure(error)}`),
          ),
        )
    },
  }
}
