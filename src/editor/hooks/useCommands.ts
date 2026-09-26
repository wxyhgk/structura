import type { RefObject } from "react"
import { sceneToSvg } from "@/chem/draw"
import { toMolfile } from "@/chem/molfile"
import { download, MOD } from "@/editor/browser"
import type { CanvasHandle } from "@/editor/Canvas"
import type { EditorState } from "@/editor/useEditor"

/** One thing the user can do, however it is reached: menu, toolbar or keyboard. */
export type Command = {
  label: string
  /** Shown next to the command, e.g. ⌘Z. */
  shortcut?: string
  enabled: boolean
  run: () => void
}

const ZOOM_STEP = 1.1

/**
 * Every editor action in one place, so the menu bar, the toolbar and the keyboard all do
 * exactly the same thing and are only in charge of presenting it.
 */
export function useCommands({
  editor,
  canvas,
  clipboard,
  openFileDialog,
  openSmilesDialog,
}: {
  editor: EditorState
  canvas: RefObject<CanvasHandle | null>
  clipboard: { copy: () => void; cut: () => void }
  openFileDialog: () => void
  openSmilesDialog: () => void
}) {
  const selected = editor.selection.atoms.length > 0 || editor.selection.bonds.length > 0
  const command = (label: string, run: () => void, options: { shortcut?: string; enabled?: boolean } = {}): Command => ({
    label,
    run,
    shortcut: options.shortcut,
    enabled: options.enabled ?? true,
  })
  return {
    newDocument: command("新建", editor.newDocument, { shortcut: `${MOD}N` }),
    open: command("打开 MOL/SDF…", openFileDialog, { shortcut: `${MOD}O` }),
    importSmiles: command("导入 SMILES…", openSmilesDialog),
    exportSvg: command("导出 SVG", () => {
      const svg = sceneToSvg(editor.mol, editor.colorHetero, editor.arrows)
      if (svg) download("未命名.svg", svg, "image/svg+xml")
    }),
    exportMol: command("导出 MOL", () => download("未命名.mol", toMolfile(editor.mol), "chemical/x-mdl-molfile")),
    undo: command("撤销", editor.undo, { shortcut: `${MOD}Z`, enabled: editor.canUndo }),
    redo: command("重做", editor.redo, { shortcut: `⇧${MOD}Z`, enabled: editor.canRedo }),
    copy: command("复制", clipboard.copy, { shortcut: `${MOD}C`, enabled: selected }),
    cut: command("剪切", clipboard.cut, { shortcut: `${MOD}X`, enabled: selected }),
    duplicate: command("重复", editor.duplicateSelection, { shortcut: `${MOD}D`, enabled: selected }),
    remove: command("删除", editor.removeSelection, { shortcut: "⌫" }),
    selectAll: command("全选", editor.selectEverything, { shortcut: `${MOD}A` }),
    rotateLeft: command("逆时针 15°", () => editor.rotateSelection(Math.PI / 12), { enabled: editor.canTransform }),
    rotateRight: command("顺时针 15°", () => editor.rotateSelection(-Math.PI / 12), { enabled: editor.canTransform }),
    rotateHalf: command("旋转 180°", () => editor.rotateSelection(Math.PI), { enabled: editor.canTransform }),
    flipHorizontal: command("水平翻转", () => editor.flipSelection("horizontal"), { enabled: editor.canTransform }),
    flipVertical: command("垂直翻转", () => editor.flipSelection("vertical"), { enabled: editor.canTransform }),
    zoomIn: command("放大", () => canvas.current?.zoomBy(ZOOM_STEP), { shortcut: `${MOD}+` }),
    zoomOut: command("缩小", () => canvas.current?.zoomBy(1 / ZOOM_STEP), { shortcut: `${MOD}−` }),
    actualSize: command("实际大小", () => canvas.current?.resetView(), { shortcut: `${MOD}0` }),
    help: command("快捷键", () => editor.setHelpOpen(true)),
  }
}

export type Commands = ReturnType<typeof useCommands>
