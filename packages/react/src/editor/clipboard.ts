import { failure, writeClipboard } from "./browser.ts"
import { downloadImage, writeImage } from "./clipboardImage.ts"
import { drawOptions } from "./drawOptions.ts"
import { pictureSvg } from "./pictureSvg.ts"
import type { EditorState } from "./useEditor.ts"

/**
 * Copy and cut put the selection on the clipboard as molfile text: `onEvent` answers the
 * browser's ⌘C / ⌘X, and `copy` / `cut` serve the Edit menu, where the menu itself would
 * block the copy event. `copyImage` puts a picture of the selection (or of the whole
 * drawing) there instead, and tells `report` when the browser refuses. A refused copy or
 * cut is said through `flash`, and a cut then leaves the selection where it is.
 */
export function selectionClipboard(
  editor: Pick<EditorState, "selectionMolfile" | "removeSelection" | "latest" | "selection" | "colorHetero" | "raisedNumbers">,
  report: (line: string) => void,
  flash: (message: string) => void,
) {
  return {
    onEvent(event: ClipboardEvent) {
      const text = editor.selectionMolfile()
      if (!text) return
      event.preventDefault()
      event.clipboardData?.setData("text/plain", text)
      if (event.type === "cut") editor.removeSelection()
    },
    async copy() {
      const text = editor.selectionMolfile()
      if (text && !(await writeClipboard(text))) flash("没能复制：浏览器不允许写入剪贴板")
    },
    async cut() {
      const text = editor.selectionMolfile()
      if (!text) return
      // Deleting before the clipboard has it would lose the structure when the write fails.
      if (await writeClipboard(text)) editor.removeSelection()
      else flash("没能剪切：浏览器不允许写入剪贴板，选中的内容没有删除")
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
