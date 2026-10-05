import type { RefObject } from "react"
import { toDocument } from "@structura/core/document"
import { sceneToSvg } from "@structura/core/draw"
import { placeholders } from "@structura/core/markush"
import { atomIdsOfSelection, bondsLeaving, emptySelection } from "@structura/core/molecule"
import { toMolfile } from "@structura/core/molfile"
import { download, MOD } from "@/editor/browser"
import type { CanvasHandle } from "@/editor/canvas/types"
import { joinOps, keyLabel, type KeyMatch, ROTATE_STEP, type Viewport, ZOOM_STEP } from "@structura/engine"
import type { EditorState } from "@/editor/useEditor"

/** One thing the user can do, however it is reached: menu, toolbar or keyboard. */
export type Command = {
  label: string
  run: () => void
  enabled: boolean
  /** Combinations that trigger it from the keyboard. */
  keys: KeyMatch[]
  /** Shown next to the command, e.g. ⌘Z. */
  shortcut?: string
  /** Checked at key time, for conditions that live outside React state. */
  when?: () => boolean
  /** Its keys work even while typing in a field (⌘S, ⌘O), as they have nothing to do with text. */
  inFields?: boolean
}

type Options = {
  keys?: KeyMatch[]
  /** A combination shown but handled elsewhere (⌘C / ⌘X use the browser's copy events). */
  hint?: KeyMatch
  enabled?: boolean
  when?: () => boolean
  inFields?: boolean
}

function command(label: string, run: () => void, options: Options = {}): Command {
  const keys = options.keys ?? []
  const shown = options.hint ?? keys[0]
  return {
    label,
    run,
    keys,
    enabled: options.enabled ?? true,
    shortcut: shown ? keyLabel(shown, MOD) : undefined,
    when: options.when,
    inFields: options.inFields,
  }
}

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
}: {
  editor: EditorState
  canvas: RefObject<CanvasHandle | null>
  viewport: Viewport
  clipboard: { copy: () => void; cut: () => void }
  openFileDialog: () => void
  openSmilesDialog: () => void
  openEnumerate: () => void
  openGuide: () => void
}) {
  const selected = editor.selection.atoms.length > 0 || editor.selection.bonds.length > 0
  const perArrow = (make: (direction: Arrow, key: string) => Command) =>
    Object.fromEntries(arrows.map((name) => [name.toLowerCase(), make(name.toLowerCase() as Arrow, `Arrow${name}`)])) as Record<Arrow, Command>

  return {
    newDocument: command("新建", editor.newDocument, { keys: [{ key: "n", meta: true }], inFields: true }),
    open: command("打开…", openFileDialog, { keys: [{ key: "o", meta: true }], inFields: true }),
    importSmiles: command("导入 SMILES…", openSmilesDialog),
    save: command("保存", () => download("未命名.structura", toDocument(editor.latest()), "application/json"), {
      keys: [{ key: "s", meta: true }],
      inFields: true,
    }),
    exportSvg: command("导出 SVG", () => {
      const svg = sceneToSvg(editor.mol, editor.colorHetero, editor.arrows)
      if (svg) download("未命名.svg", svg, "image/svg+xml")
    }),
    exportMol: command("导出 MOL", () => download("未命名.mol", toMolfile(editor.mol), "chemical/x-mdl-molfile")),
    undo: command("撤销", editor.undo, { keys: [{ key: "z", meta: true }], enabled: editor.canUndo }),
    redo: command("重做", editor.redo, {
      keys: [{ key: "z", meta: true, shift: true }, { key: "y", meta: true }],
      enabled: editor.canRedo,
    }),
    copy: command("复制", clipboard.copy, { hint: { key: "c", meta: true }, enabled: selected }),
    cut: command("剪切", clipboard.cut, { hint: { key: "x", meta: true }, enabled: selected }),
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
    join: command("连接选中的两个原子 / 两根键", () => editor.run(joinOps(editor.mol, editor.selection) ?? []), {
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
    zoomIn: command("放大", () => viewport.zoomBy(ZOOM_STEP), { keys: [{ key: "=", meta: true }, { key: "+", meta: true }] }),
    zoomOut: command("缩小", () => viewport.zoomBy(1 / ZOOM_STEP), { keys: [{ key: "-", meta: true }] }),
    actualSize: command("实际大小", () => viewport.reset(), { keys: [{ key: "0", meta: true }] }),
    guide: command("使用说明", openGuide, { keys: [{ key: "F1" }], inFields: true }),
    help: command("快捷键", () => editor.setHelpOpen(true)),
  }
}

export type Commands = ReturnType<typeof useCommands>

/** Every command, including the per-arrow ones, for key routing and the help page. */
export function allCommands(commands: Commands): Command[] {
  return Object.values(commands).flatMap((entry) => ("run" in entry ? [entry as Command] : Object.values(entry)))
}
