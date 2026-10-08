import type { RefObject } from "react"
import { toDocument } from "@structura/core/document"
import { sceneToSvg } from "@structura/core/draw"
import { placeholders, variableLabels } from "@structura/markush"
import { atomIdsOfSelection, bondsLeaving, emptySelection, groupsTouching } from "@structura/core/molecule"
import { toMolfile } from "@structura/core/molfile"
import { download, MOD } from "../browser.ts"
import type { CanvasHandle } from "../canvas/types.ts"
import { type Command, command as engineCommand, type CommandOptions, drawingPoints, joinOps, ROTATE_STEP, type Viewport } from "@structura/engine"
import { drawOptions } from "../drawOptions.ts"
import type { DocumentFile } from "./useDocumentFile.ts"
import type { EditorState } from "../useEditor.ts"

/** A command, its shortcut written the way this platform does (⌘ or Ctrl). */
const command = (label: string, run: () => void, options?: CommandOptions): Command => engineCommand(label, run, options, MOD)

const arrows = ["Left", "Right", "Up", "Down"] as const
type Arrow = Lowercase<(typeof arrows)[number]>

/**
 * Every editor action in one place, so the menu bar, the toolbar and the keyboard all do
 * exactly the same thing and are only in charge of presenting it.
 */
export function useCommands({
  editor,
  canvas,
  viewport,
  clipboard,
  openFileDialog,
  openSmilesDialog,
  openEnumerate,
  openGuide,
  openRecognize,
  openFill,
  file,
}: {
  editor: EditorState
  canvas: RefObject<CanvasHandle | null>
  viewport: Viewport
  clipboard: { copy: () => void; cut: () => void; paste: () => void; copyImage: () => void }
  openFileDialog: () => void
  openSmilesDialog: () => void
  openEnumerate: () => void
  openGuide: () => void
  /** Absent when the host has no way to reach a model. */
  openRecognize?: () => void
  /** 从专利文字填写; absent when the host has no way to reach a model. */
  openFill?: () => void
  /** Which file this is: the names things are saved under, and what counts as saved. */
  file: DocumentFile
}) {
  const selected = editor.selection.atoms.length > 0 || editor.selection.bonds.length > 0
  /** The abbreviations the expand/collapse commands act on that are now collapsed (or not). */
  const groupsIn = (collapsed: boolean) => {
    const ids = new Set(groupsTouching(editor.mol, selected ? atomIdsOfSelection(editor.mol, editor.selection) : null))
    return editor.mol.groups.filter((group) => ids.has(group.id) && group.collapsed === collapsed)
  }
  const setCollapsed = (collapsed: boolean) =>
    editor.run([{ op: "set_collapsed", ...(selected ? { atoms: atomIdsOfSelection(editor.mol, editor.selection) } : {}), collapsed }], { keepSelection: true })
  const perArrow = (make: (direction: Arrow, key: string) => Command) =>
    Object.fromEntries(arrows.map((name) => [name.toLowerCase(), make(name.toLowerCase() as Arrow, `Arrow${name}`)])) as Record<Arrow, Command>

  return {
    newDocument: command(
      "新建",
      () => {
        editor.newDocument()
        file.markSaved(null)
      },
      { keys: [{ key: "n", meta: true }], inFields: true },
    ),
    open: command("打开…", openFileDialog, { keys: [{ key: "o", meta: true }], inFields: true }),
    importSmiles: command("导入 SMILES…", openSmilesDialog),
    recognizeImage: command("从图片识别结构…", () => openRecognize?.(), { enabled: openRecognize != null }),
    // Filling needs variables to fill: labels such as R1, X on the formula, or ones already defined (as the variables panel shows them).
    fillFromText: command("从专利文字填写变量…", () => openFill?.(), {
      enabled: openFill != null && (variableLabels(editor.mol).length > 0 || Object.keys(editor.variables ?? {}).length > 0),
    }),
    save: command(
      "保存",
      () => {
        download(`${file.base}.structura`, toDocument(editor.latest()), "application/json")
        file.markSaved(`${file.base}.structura`)
      },
      {
      keys: [{ key: "s", meta: true }],
      inFields: true,
    }),
    exportSvg: command("导出 SVG", () => {
      const svg = sceneToSvg(editor.mol, editor.colorHetero, editor.arrows, editor.attachments, drawOptions(editor.raisedNumbers))
      if (svg) download(`${file.base}.svg`, svg, "image/svg+xml")
    }),
    exportMol: command("导出 MOL", () => download(`${file.base}.mol`, toMolfile(editor.mol), "chemical/x-mdl-molfile")),
    undo: command("撤销", editor.undo, { keys: [{ key: "z", meta: true }], enabled: editor.canUndo }),
    redo: command("重做", editor.redo, {
      keys: [{ key: "z", meta: true, shift: true }, { key: "y", meta: true }],
      enabled: editor.canRedo,
    }),
    copy: command("复制", clipboard.copy, { hint: { key: "c", meta: true }, enabled: selected }),
    cut: command("剪切", clipboard.cut, { hint: { key: "x", meta: true }, enabled: selected }),
    // The browser's own ⌘V pastes on the canvas; the menu reads the clipboard itself.
    paste: command("粘贴", clipboard.paste, { hint: { key: "v", meta: true } }),
    // The selection, or the whole drawing, as a picture for Word and PowerPoint.
    copyImage: command("复制为图片", clipboard.copyImage, {
      keys: [{ key: "c", meta: true, shift: true }],
      enabled: editor.mol.atoms.length > 0,
    }),
    duplicate: command("重复", editor.duplicateSelection, { keys: [{ key: "d", meta: true }], enabled: selected }),
    remove: command("删除", editor.removeSelection, { keys: [{ key: "Backspace" }, { key: "Delete" }] }),
    selectAll: command("全选", editor.selectEverything, { keys: [{ key: "a", meta: true }] }),
    rotateLeft: command("逆时针 15°", () => editor.rotateSelection(ROTATE_STEP), {
      keys: [{ key: "ArrowLeft", alt: true }, { key: "ArrowUp", alt: true }],
      enabled: editor.canTransform,
    }),
    rotateRight: command("顺时针 15°", () => editor.rotateSelection(-ROTATE_STEP), {
      keys: [{ key: "ArrowRight", alt: true }, { key: "ArrowDown", alt: true }],
      enabled: editor.canTransform,
    }),
    rotateHalf: command("旋转 180°", () => editor.rotateSelection(Math.PI), { enabled: editor.canTransform }),
    flipHorizontal: command("水平翻转", () => editor.flipSelection("horizontal"), { enabled: editor.canTransform }),
    flipVertical: command("垂直翻转", () => editor.flipSelection("vertical"), { enabled: editor.canTransform }),
    // ChemDraw's Clean Up Structure key.
    clean: command(selected ? "整理选中部分" : "整理结构", editor.cleanSelection, {
      keys: [{ key: "k", meta: true, shift: true }],
      enabled: editor.mol.atoms.length > 0,
    }),
    // Abbreviations (Ph, Boc…): the selected ones, or all of them with nothing selected.
    expandGroups: command(selected ? "展开选中的缩写" : "展开全部缩写", () => setCollapsed(false), { enabled: groupsIn(true).length > 0 }),
    collapseGroups: command(selected ? "收起选中的缩写" : "收起全部缩写", () => setCollapsed(true), { enabled: groupsIn(false).length > 0 }),
    replace: command(
      "替换选中部分…",
      () => {
        const ids = atomIdsOfSelection(editor.mol, editor.selection)
        if (ids.length > 0) canvas.current?.replaceFragment(ids)
      },
      // Only a fragment joined to the rest by one bond (or a whole molecule) can be swapped.
      { keys: [{ key: "e", meta: true }], enabled: selected && bondsLeaving(editor.mol, atomIdsOfSelection(editor.mol, editor.selection)).length <= 1 },
    ),
    // A field by the pointer: no single key per template, so none clashes with the hover keys.
    quickScaffold: command("快速放模板…", () => canvas.current?.quickScaffold(), { keys: [{ key: "/" }] }),
    // Two atoms (or two bonds) of two pieces selected: join the pieces there.
    join: command("连接所选", () => editor.run(joinOps(editor.mol, editor.selection) ?? []), {
      keys: [{ key: "j", meta: true }],
      enabled: joinOps(editor.mol, editor.selection) != null,
    }),
    enumerate: command("批量生成化合物…", openEnumerate, {
      enabled: placeholders({ molecule: editor.mol, arrows: editor.arrows, nextArrowId: 0, variables: editor.variables }).length > 0,
    }),
    nudge: perArrow((direction, key) =>
      command("移动 10 像素", () => editor.nudgeSelection(direction), { keys: [{ key, shift: true }], enabled: selected }),
    ),
    tumble: perArrow((direction, key) =>
      command("3D 翻转", () => editor.tumbleSelection(direction), { keys: [{ key, shift: true, alt: true }], enabled: editor.canTransform }),
    ),
    arrow: perArrow((direction, key) =>
      command("反应箭头", () => editor.addArrow(direction), { keys: [{ key, meta: true }], enabled: selected }),
    ),
    cancel: command(
      "取消 / 取消选中 / 套索",
      () => {
        if (canvas.current?.hasGesture()) canvas.current.cancelGesture()
        else if (selected) editor.setSelection(emptySelection())
        else editor.setTool("lasso")
      },
      { keys: [{ key: "Escape" }] },
    ),
    focusHotspot: command(
      "选中的分子 → 热点原子",
      () => {
        const id = editor.selectionHotspot()
        if (id != null) canvas.current?.focusAtom(id)
      },
      { keys: [{ key: "Enter" }], when: () => !canvas.current?.hotspot() && editor.selectionHotspot() != null },
    ),
    zoomIn: command("放大", () => viewport.zoomStep(1), { keys: [{ key: "=", meta: true }, { key: "+", meta: true }] }),
    zoomOut: command("缩小", () => viewport.zoomStep(-1), { keys: [{ key: "-", meta: true }] }),
    actualSize: command("实际大小", () => viewport.reset(), { keys: [{ key: "0", meta: true }] }),
    // Asked for, so it may move the view: the way back to a drawing lost on the infinite canvas.
    fitAll: command("显示全部", () => viewport.fit(drawingPoints(editor.mol, editor.arrows)), {
      keys: [{ key: "9", meta: true }],
      enabled: editor.mol.atoms.length > 0 || editor.arrows.length > 0,
    }),
    guide: command("使用说明", openGuide, { keys: [{ key: "F1" }], inFields: true }),
    help: command("快捷键", () => editor.setHelpOpen(true)),
  }
}

export type Commands = ReturnType<typeof useCommands>
