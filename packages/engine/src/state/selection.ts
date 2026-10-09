import { atomIdsOfSelection, boundsCenter, neighbors, selectAll, selectionFromAtoms, subMolecule } from "@structura/core/molecule"
import { bracketsWithin } from "@structura/core/drawing"
import { toMolfile } from "@structura/core/molfile"
import type { BondStyle, Molecule } from "@structura/core/types"
import { selectionHotkeyOps, selectionTips } from "../hotkeys/lookup.ts"
import { ROTATE_STEP } from "../view/steps.ts"
import type { EditorStore } from "./store.ts"

type Direction = "left" | "right" | "up" | "down"

/**
 * What the editor does to the selection: the commands behind the menus and keys that act on
 * selected atoms. Each reads the selection and the drawing as they are now, so a call never
 * acts on something an earlier render showed.
 */
export function selectionActions(store: EditorStore) {
  /** The selected atoms (and the ends of selected bonds) in the latest molecule. */
  const selected = () => {
    const now = store.latest().molecule
    return { now, ids: atomIdsOfSelection(now, store.get().selection) }
  }
  /** Depth from the last tumble, valid only while the molecule is still the one it produced. */
  let tumbleDepth: { mol: Molecule; depth: Record<number, number> | undefined } | null = null

  return {
    removeSelection() {
      const { selection } = store.get()
      if (selection.atoms.length === 0 && selection.bonds.length === 0) return
      store.run([{ op: "remove", atoms: selection.atoms, bonds: selection.bonds }])
    },
    /** Copies the selection beside itself and selects the copy, ready to drag. */
    duplicateSelection() {
      const { ids } = selected()
      if (ids.length === 0) return
      const copy = store.run([{ op: "duplicate", atoms: ids }], { keepSelection: true })
      if (copy) store.setSelection(selectionFromAtoms(copy.drawing.molecule, copy.added.atoms))
    },
    /** The selection as molfile text for the clipboard, or null when nothing is selected; brackets wholly inside go along. */
    selectionMolfile(): string | null {
      const { now, ids } = selected()
      return ids.length > 0 ? toMolfile(subMolecule(now, ids), "Structura", bracketsWithin(store.latest().brackets, ids)) : null
    },
    /** Puts square brackets round the selected atoms, a group bracket to start with; the selection stays. */
    bracketSelection() {
      const { ids } = selected()
      if (ids.length === 0) return
      store.run([{ op: "add_bracket", atoms: ids }], { keepSelection: true })
    },
    selectEverything: () => store.setSelection(selectAll(store.latest().molecule)),
    /** An element key or palette click: selected atoms become it, else it becomes the atom tool's element. */
    applyElement(el: string) {
      const { selection } = store.get()
      if (selection.atoms.length > 0) {
        store.run(selection.atoms.map((atom) => ({ op: "set_element", atom, el })), { keepSelection: true })
        return
      }
      store.setAtomEl(el)
      store.setTool("atom")
    },
    /** 1, 2 or 3: the bond tool with that order, and selected bonds get it too. */
    applyBondOrder(order: 1 | 2 | 3) {
      const style: BondStyle = { order, stereo: "none" }
      store.setBondStyle(style)
      store.setTool("bond")
      const { selection } = store.get()
      if (selection.bonds.length > 0) store.run(selection.bonds.map((bond) => ({ op: "set_bond", bond, order })), { keepSelection: true })
    },
    rotateSelection(angle: number) {
      const { now, ids } = selected()
      const center = boundsCenter(now, ids)
      if (!center || ids.length < 2) return
      store.run([{ op: "rotate", atoms: ids, angle, center }], { keepSelection: true })
    },
    nudgeSelection(direction: Direction) {
      const { ids } = selected()
      if (ids.length === 0) return
      const dx = direction === "left" ? -10 : direction === "right" ? 10 : 0
      const dy = direction === "up" ? -10 : direction === "down" ? 10 : 0
      store.run([{ op: "move", atoms: ids, dx, dy }], { keepSelection: true })
    },
    tumbleSelection(direction: Direction) {
      const { now, ids } = selected()
      const center = boundsCenter(now, ids)
      if (!center || ids.length < 2) return
      const axis = direction === "left" || direction === "right" ? "y" : "x"
      const sign = direction === "left" || direction === "up" ? 1 : -1
      const depth = tumbleDepth?.mol === now ? tumbleDepth.depth : undefined
      const result = store.run([{ op: "tumble", atoms: ids, axis, angle: sign * ROTATE_STEP, center, depth }], { keepSelection: true })
      if (result) tumbleDepth = { mol: store.latest().molecule, depth: result.depth }
    },
    addArrow(direction: Direction) {
      const { ids } = selected()
      if (ids.length === 0) return
      store.run([{ op: "add_arrow", atoms: ids, direction }], { keepSelection: true })
    },
    /**
     * A hover key pressed with a selection acts on the whole selection as one edit. The
     * selection then follows the new tips, so pressing 1 again grows every chain once more.
     * False if the key means nothing there.
     */
    hotkeySelection(key: string): boolean {
      const { selection } = store.get()
      const ops = selectionHotkeyOps(store.latest().molecule, selection, key)
      if (!ops) return false
      const result = store.run(ops, { keepSelection: true })
      if (!result || selection.atoms.length === 0) return true
      const tips = selectionTips(selection.atoms, result.names)
      // Keys that change an atom in place (O, +, Me…) keep the selection as it was.
      if (tips.some((tip, index) => tip !== selection.atoms[index])) store.setSelection(selectionFromAtoms(result.drawing.molecule, [...new Set(tips)]))
      return true
    },
    /** Where keys go after Enter on a selected molecule: an end atom of it, else any. */
    selectionHotspot(): number | null {
      const { now, ids } = selected()
      return ids.find((id) => neighbors(now, id).length <= 1) ?? ids[0] ?? null
    },
    flipSelection(axis: "horizontal" | "vertical") {
      const { ids } = selected()
      if (ids.length < 2) return
      store.run([{ op: "flip", atoms: ids, axis }], { keepSelection: true })
    },
    /** Tidies the selected atoms, or the whole drawing when nothing is selected; the selection stays. */
    cleanSelection() {
      const { now, ids } = selected()
      if (now.atoms.length === 0) return
      store.run([ids.length > 0 ? { op: "clean", atoms: ids } : { op: "clean" }], { keepSelection: true })
    },
  }
}
