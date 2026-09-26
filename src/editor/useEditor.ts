import { useCallback, useMemo, useReducer, useRef, useState } from "react"
import {
  displayFormula,
  molecularWeight,
  plainFormula,
  valenceErrorCount,
} from "@/chem/formula"
import { addReactionArrow, emptyDrawing } from "@/chem/drawing"
import { emptyHistory, historyReducer } from "@/chem/history"
import { toMolfile } from "@/chem/molfile"
import type { Op } from "@/chem/ops"
import { ROTATE_STEP } from "@/editor/canvas/view"
import { runOps } from "@/editor/ops"
import {
  atomIdsOfSelection,
  subMolecule,
  boundsCenter,
  componentOf,
  emptySelection,
  neighbors,
  selectAll,
  selectionFromAtoms,
  tumbleAtoms,
} from "@/chem/molecule"
import type { BondStyle, Drawing, Molecule, RingKind, Selection, ToolId } from "@/chem/types"

export function useEditor() {
  const [history, dispatch] = useReducer(historyReducer, undefined, emptyHistory)
  const [tool, setTool] = useState<ToolId>("bond")
  const [bondStyle, setBondStyle] = useState<BondStyle>({ order: 1, stereo: "none" })
  const [ringKind, setRingKind] = useState<RingKind>("benzene")
  const [atomEl, setAtomEl] = useState("N")
  const [selection, setSelection] = useState<Selection>(emptySelection())
  const [colorHetero, setColorHetero] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  /** Depth from the last tumble, valid only while the molecule is still the one it produced. */
  const tumbleDepth = useRef<{ mol: Molecule; depth: Map<number, number> } | null>(null)
  const drawing = history.present
  const mol = drawing.molecule

  const commit = useCallback((next: Molecule, keepSelection = false) => {
    dispatch({ type: "commit-molecule", mol: next })
    if (!keepSelection) setSelection(emptySelection())
  }, [])

  const commitDrawing = useCallback((next: Drawing, keepSelection = false) => {
    dispatch({ type: "commit", drawing: next })
    if (!keepSelection) setSelection(emptySelection())
  }, [])

  const undo = useCallback(() => {
    dispatch({ type: "undo" })
    setSelection(emptySelection())
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: "redo" })
    setSelection(emptySelection())
  }, [])

  const removeSelection = useCallback(() => {
    if (selection.atoms.length === 0 && selection.bonds.length === 0) return
    runOps(mol, [{ op: "remove", atoms: selection.atoms, bonds: selection.bonds }], commit)
  }, [commit, mol, selection])

  /** Copies the selection beside itself and selects the copy, ready to drag. */
  const duplicateSelection = useCallback(() => {
    const ids = atomIdsOfSelection(mol, selection)
    if (ids.length === 0) return
    const copy = runOps(mol, [{ op: "duplicate", atoms: ids }], commit, { keepSelection: true })
    if (copy) setSelection(selectionFromAtoms(copy.mol, copy.added.atoms))
  }, [commit, mol, selection])

  /** The selection as molfile text for the clipboard, or null when nothing is selected. */
  const selectionMolfile = useCallback((): string | null => {
    const ids = atomIdsOfSelection(mol, selection)
    return ids.length > 0 ? toMolfile(subMolecule(mol, ids), "Structura") : null
  }, [mol, selection])

  const selectEverything = useCallback(() => {
    setSelection(selectAll(mol))
  }, [mol])

  const applyElement = useCallback(
    (el: string) => {
      if (selection.atoms.length > 0) {
        runOps(mol, selection.atoms.map((atom) => ({ op: "set_element", atom, el })), commit, { keepSelection: true })
        return
      }
      setAtomEl(el)
      setTool("atom")
    },
    [commit, mol, selection.atoms],
  )

  const applyBondOrder = useCallback(
    (order: 1 | 2 | 3) => {
      const style: BondStyle = { order, stereo: "none" }
      setBondStyle(style)
      setTool("bond")
      if (selection.bonds.length > 0) runOps(mol, selection.bonds.map((bond) => ({ op: "set_bond", bond, order })), commit, { keepSelection: true })
    },
    [commit, mol, selection.bonds],
  )

  const selectionIds = atomIdsOfSelection(mol, selection)
  const canTransform = selectionIds.length >= 2

  const rotateSelection = useCallback(
    (angle: number) => {
      const ids = atomIdsOfSelection(mol, selection)
      const center = boundsCenter(mol, ids)
      if (!center || ids.length < 2) return
      runOps(mol, [{ op: "rotate", atoms: ids, angle, center }], commit, { keepSelection: true })
    },
    [commit, mol, selection],
  )

  const nudgeSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const ids = atomIdsOfSelection(mol, selection)
      if (ids.length === 0) return
      const dx = direction === "left" ? -10 : direction === "right" ? 10 : 0
      const dy = direction === "up" ? -10 : direction === "down" ? 10 : 0
      runOps(mol, [{ op: "move", atoms: ids, dx, dy }], commit, { keepSelection: true })
    },
    [commit, mol, selection],
  )

  const tumbleSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const ids = atomIdsOfSelection(mol, selection)
      const center = boundsCenter(mol, ids)
      if (!center || ids.length < 2) return
      const axis = direction === "left" || direction === "right" ? "y" : "x"
      const sign = direction === "left" || direction === "up" ? 1 : -1
      const depth = tumbleDepth.current?.mol === mol ? tumbleDepth.current.depth : undefined
      const tumbled = tumbleAtoms(mol, ids, center, axis, sign * ROTATE_STEP, depth)
      tumbleDepth.current = tumbled
      commit(tumbled.mol, true)
    },
    [commit, mol, selection],
  )

  const addArrow = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const ids = atomIdsOfSelection(mol, selection)
      if (ids.length === 0) return
      commitDrawing(addReactionArrow(drawing, ids, direction), true)
    },
    [commitDrawing, drawing, mol, selection],
  )

  const grabHit = useCallback(
    (hit: { type: "atom" | "bond"; id: number }) => {
      if (hit.type === "atom") setSelection({ atoms: [hit.id], bonds: [] })
      else setSelection({ atoms: [], bonds: [hit.id] })
    },
    [],
  )

  const selectionHotspot = useCallback(() => {
    const ids = atomIdsOfSelection(mol, selection)
    return ids.find((id) => neighbors(mol, id).length <= 1) ?? ids[0] ?? null
  }, [mol, selection])

  const selectComponent = useCallback(
    (atomId: number) => {
      setSelection(selectionFromAtoms(mol, componentOf(mol, atomId)))
    },
    [mol],
  )

  const flipSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      const ids = atomIdsOfSelection(mol, selection)
      if (ids.length < 2) return
      runOps(mol, [{ op: "flip", atoms: ids, axis }], commit, { keepSelection: true })
    },
    [commit, mol, selection],
  )

  const applyCharge = useCallback(
    (delta: number) => {
      if (selection.atoms.length === 0) return
      const ops = selection.atoms.flatMap((id): Op[] => {
        const atom = mol.atoms.find((item) => item.id === id)
        return atom ? [{ op: "set_charge", atom: id, charge: Math.max(-3, Math.min(3, atom.charge + delta)) }] : []
      })
      runOps(mol, ops, commit, { keepSelection: true })
    },
    [commit, mol, selection.atoms],
  )

  /** Replaces the drawing with an opened file's molecules, as one undoable step. */
  const openMolecules = useCallback((molecules: Molecule[]) => {
    dispatch({ type: "open", molecules })
    setSelection(emptySelection())
  }, [])

  /** Adds imported molecules beside the drawing as it is when they arrive. */
  const appendMolecules = useCallback((molecules: Molecule[]) => {
    dispatch({ type: "append", molecules })
    setSelection(emptySelection())
  }, [])

  const newDocument = useCallback(() => {
    if (mol.atoms.length === 0 && drawing.arrows.length === 0) return
    commitDrawing(emptyDrawing())
  }, [commitDrawing, drawing.arrows.length, mol.atoms.length])

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
    commit,
    undo,
    redo,
    removeSelection,
    duplicateSelection,
    selectionMolfile,
    selectEverything,
    applyElement,
    applyBondOrder,
    applyCharge,
    rotateSelection,
    nudgeSelection,
    tumbleSelection,
    addArrow,
    grabHit,
    selectComponent,
    selectionHotspot,
    flipSelection,
    newDocument,
    openMolecules,
    appendMolecules,
  }
}

/** Everything the editor state hook exposes; shell components and hooks take this. */
export type EditorState = ReturnType<typeof useEditor>
