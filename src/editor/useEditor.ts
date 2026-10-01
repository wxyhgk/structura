import { useCallback, useMemo, useRef, useState } from "react"
import {
  displayFormula,
  molecularWeight,
  plainFormula,
  valenceErrorCount,
} from "@structura/core/formula"
import { emptyDrawing } from "@structura/core/drawing"
import { toMolfile } from "@structura/core/molfile"
import { applyOps, type Op } from "@structura/core/ops"
import { ROTATE_STEP } from "@/editor/canvas/view"
import { useHistory } from "@/editor/hooks/useHistory"
import { selectionHotkeyOps, selectionTips } from "@/editor/hotkeys/lookup"
import type { Run, RunOptions } from "@/editor/ops"
import {
  atomIdsOfSelection,
  subMolecule,
  boundsCenter,
  emptySelection,
  neighbors,
  selectAll,
  selectionFromAtoms,
} from "@structura/core/molecule"
import type { BondStyle, Drawing, Molecule, Point, RingKind, Selection } from "@structura/core/types"
import type { ToolId } from "@/editor/tools/types"

export function useEditor(initial: Molecule[] | Drawing = []) {
  const { history, dispatch, latest } = useHistory(initial)
  const [tool, setTool] = useState<ToolId>("bond")
  const [bondStyle, setBondStyle] = useState<BondStyle>({ order: 1, stereo: "none" })
  const [ringKind, setRingKind] = useState<RingKind>("benzene")
  const [atomEl, setAtomEl] = useState("N")
  const [selection, setSelection] = useState<Selection>(emptySelection())
  const [colorHetero, setColorHetero] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  /** Depth from the last tumble, valid only while the molecule is still the one it produced. */
  const tumbleDepth = useRef<{ mol: Molecule; depth: Record<number, number> | undefined } | null>(null)
  const drawing = history.present
  const mol = drawing.molecule

  /**
   * The one write path: every edit, from a key, a gesture, a menu or an agent, is ops
   * applied to the latest drawing, so a caller never builds on a molecule it rendered
   * earlier. Synchronous, so the next key can aim at what this one made.
   */
  const run: Run = useCallback(
    (ops: Op[], options: RunOptions = {}) => {
      const result = applyOps(latest(), ops)
      if (!result.ok) {
        options.onReject?.({ index: result.index, error: result.error })
        if (!options.quiet && !options.onReject) console.warn(`edit rejected at op ${result.index}: ${result.error}`)
        return null
      }
      dispatch({ type: "commit", drawing: result.drawing })
      if (!options.keepSelection) setSelection(emptySelection())
      return result
    },
    [dispatch, latest],
  )

  /** The selected atoms (and the ends of selected bonds) in the latest molecule. */
  const selected = useCallback(() => {
    const now = latest().molecule
    return { now, ids: atomIdsOfSelection(now, selection) }
  }, [latest, selection])

  const undo = useCallback(() => {
    dispatch({ type: "undo" })
    setSelection(emptySelection())
  }, [dispatch])

  const redo = useCallback(() => {
    dispatch({ type: "redo" })
    setSelection(emptySelection())
  }, [dispatch])

  const removeSelection = useCallback(() => {
    if (selection.atoms.length === 0 && selection.bonds.length === 0) return
    run([{ op: "remove", atoms: selection.atoms, bonds: selection.bonds }])
  }, [run, selection])

  /** Copies the selection beside itself and selects the copy, ready to drag. */
  const duplicateSelection = useCallback(() => {
    const { ids } = selected()
    if (ids.length === 0) return
    const copy = run([{ op: "duplicate", atoms: ids }], { keepSelection: true })
    if (copy) setSelection(selectionFromAtoms(copy.drawing.molecule, copy.added.atoms))
  }, [run, selected])

  /** The selection as molfile text for the clipboard, or null when nothing is selected. */
  const selectionMolfile = useCallback((): string | null => {
    const { now, ids } = selected()
    return ids.length > 0 ? toMolfile(subMolecule(now, ids), "Structura") : null
  }, [selected])

  const selectEverything = useCallback(() => {
    setSelection(selectAll(latest().molecule))
  }, [latest])

  const applyElement = useCallback(
    (el: string) => {
      if (selection.atoms.length > 0) {
        run(selection.atoms.map((atom) => ({ op: "set_element", atom, el })), { keepSelection: true })
        return
      }
      setAtomEl(el)
      setTool("atom")
    },
    [run, selection.atoms],
  )

  const applyBondOrder = useCallback(
    (order: 1 | 2 | 3) => {
      const style: BondStyle = { order, stereo: "none" }
      setBondStyle(style)
      setTool("bond")
      if (selection.bonds.length > 0) run(selection.bonds.map((bond) => ({ op: "set_bond", bond, order })), { keepSelection: true })
    },
    [run, selection.bonds],
  )

  const selectionIds = atomIdsOfSelection(mol, selection)
  const canTransform = selectionIds.length >= 2

  const rotateSelection = useCallback(
    (angle: number) => {
      const { now, ids } = selected()
      const center = boundsCenter(now, ids)
      if (!center || ids.length < 2) return
      run([{ op: "rotate", atoms: ids, angle, center }], { keepSelection: true })
    },
    [run, selected],
  )

  const nudgeSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const { ids } = selected()
      if (ids.length === 0) return
      const dx = direction === "left" ? -10 : direction === "right" ? 10 : 0
      const dy = direction === "up" ? -10 : direction === "down" ? 10 : 0
      run([{ op: "move", atoms: ids, dx, dy }], { keepSelection: true })
    },
    [run, selected],
  )

  const tumbleSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const { now, ids } = selected()
      const center = boundsCenter(now, ids)
      if (!center || ids.length < 2) return
      const axis = direction === "left" || direction === "right" ? "y" : "x"
      const sign = direction === "left" || direction === "up" ? 1 : -1
      const depth = tumbleDepth.current?.mol === now ? tumbleDepth.current.depth : undefined
      const result = run([{ op: "tumble", atoms: ids, axis, angle: sign * ROTATE_STEP, center, depth }], { keepSelection: true })
      if (result) tumbleDepth.current = { mol: latest().molecule, depth: result.depth }
    },
    [latest, run, selected],
  )

  const addArrow = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const { ids } = selected()
      if (ids.length === 0) return
      run([{ op: "add_arrow", atoms: ids, direction }], { keepSelection: true })
    },
    [run, selected],
  )

  /**
   * A hover key pressed with a selection acts on the whole selection as one edit. The
   * selection then follows the new tips, so pressing 1 again grows every chain once more.
   * False if the key means nothing there.
   */
  const hotkeySelection = useCallback(
    (key: string): boolean => {
      const ops = selectionHotkeyOps(latest().molecule, selection, key)
      if (!ops) return false
      const result = run(ops, { keepSelection: true })
      if (!result || selection.atoms.length === 0) return true
      const tips = selectionTips(selection.atoms, result.names)
      // Keys that change an atom in place (O, +, Me…) keep the selection as it was.
      if (tips.some((tip, index) => tip !== selection.atoms[index])) setSelection(selectionFromAtoms(result.drawing.molecule, [...new Set(tips)]))
      return true
    },
    [latest, run, selection],
  )

  const selectionHotspot = useCallback(() => {
    const { now, ids } = selected()
    return ids.find((id) => neighbors(now, id).length <= 1) ?? ids[0] ?? null
  }, [selected])

  const flipSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      const { ids } = selected()
      if (ids.length < 2) return
      run([{ op: "flip", atoms: ids, axis }], { keepSelection: true })
    },
    [run, selected],
  )

  /** Tidies the selected atoms, or the whole drawing when nothing is selected; the selection stays. */
  const cleanSelection = useCallback(() => {
    const { now, ids } = selected()
    if (now.atoms.length === 0) return
    run([ids.length > 0 ? { op: "clean", atoms: ids } : { op: "clean" }], { keepSelection: true })
  }, [run, selected])

  // Opening, importing and starting over replace or extend the document as a whole, so
  // they stay history actions rather than ops; each is still one undoable step.

  /** Replaces the drawing with an opened file's molecules, centred on `at`. */
  const openMolecules = useCallback(
    (molecules: Molecule[], at?: Point) => {
      dispatch({ type: "open", molecules, at })
      setSelection(emptySelection())
    },
    [dispatch],
  )

  /** Adds imported molecules beside the drawing as it is when they arrive; round `at` on an empty page. */
  const appendMolecules = useCallback(
    (molecules: Molecule[], at?: Point) => {
      dispatch({ type: "append", molecules, at })
      setSelection(emptySelection())
    },
    [dispatch],
  )

  /** Replaces the drawing with a saved Structura document, as one undoable step. */
  const loadDrawing = useCallback(
    (saved: Drawing) => {
      dispatch({ type: "load", drawing: saved })
      setSelection(emptySelection())
    },
    [dispatch],
  )

  const newDocument = useCallback(() => {
    const now = latest()
    if (now.molecule.atoms.length === 0 && now.arrows.length === 0) return
    dispatch({ type: "commit", drawing: emptyDrawing() })
    setSelection(emptySelection())
  }, [dispatch, latest])

  // The status bar only changes with the molecule or the selected atoms, not on zoom or hover.
  const status = useMemo(() => {
    const source = selection.atoms.length > 0 ? selection.atoms : undefined
    const formula = plainFormula(mol, source)
    return {
      formula: displayFormula(formula),
      weight: formula ? molecularWeight(mol, source) : 0,
      valenceErrors: valenceErrorCount(mol),
    }
  }, [mol, selection.atoms])

  return {
    mol,
    arrows: drawing.arrows,
    /** The whole drawing as rendered: molecule, arrows and the generic formula's variables and attachments. */
    drawing,
    variables: drawing.variables,
    attachments: drawing.attachments,
    tool,
    bondStyle,
    ringKind,
    atomEl,
    selection,
    colorHetero,
    helpOpen,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canTransform,
    ...status,
    setTool,
    setBondStyle,
    setRingKind,
    setAtomEl,
    setSelection,
    setColorHetero,
    setHelpOpen,
    run,
    latest,
    undo,
    redo,
    removeSelection,
    duplicateSelection,
    selectionMolfile,
    selectEverything,
    applyElement,
    applyBondOrder,
    rotateSelection,
    nudgeSelection,
    tumbleSelection,
    addArrow,
    selectionHotspot,
    hotkeySelection,
    flipSelection,
    cleanSelection,
    newDocument,
    openMolecules,
    appendMolecules,
    loadDrawing,
  }
}

/** Everything the editor state hook exposes; shell components and hooks take this. */
export type EditorState = ReturnType<typeof useEditor>
