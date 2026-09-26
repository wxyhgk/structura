import { useCallback, useReducer, useState } from "react"
import {
  displayFormula,
  molecularWeight,
  plainFormula,
  valenceErrorCount,
} from "@/chem/formula"
import { addReactionArrow, emptyDrawing } from "@/chem/drawing"
import {
  atomIdsOfSelection,
  bumpCharge,
  boundsCenter,
  componentOf,
  deleteSelection,
  emptySelection,
  flipAtoms,
  moveAtoms,
  neighbors,
  rotateAtoms,
  selectAll,
  selectionFromAtoms,
  setBondOrder,
  setElement,
  tumbleAtoms,
} from "@/chem/molecule"
import type { BondStyle, Drawing, Molecule, RingKind, Selection, ToolId } from "@/chem/types"

type History = {
  past: Drawing[]
  present: Drawing
  future: Drawing[]
}

type HistoryAction =
  | { type: "commit"; drawing: Drawing }
  | { type: "commit-molecule"; mol: Molecule }
  | { type: "undo" }
  | { type: "redo" }

function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "commit" || action.type === "commit-molecule") {
    const present = action.type === "commit" ? action.drawing : { ...state.present, molecule: action.mol }
    return {
      past: [...state.past, state.present].slice(-100),
      present,
      future: [],
    }
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1)
    if (!previous) return state
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    }
  }
  const next = state.future[0]
  if (!next) return state
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  }
}

const initialHistory: History = {
  past: [],
  present: emptyDrawing(),
  future: [],
}

export function useEditor() {
  const [history, dispatch] = useReducer(historyReducer, initialHistory)
  const [tool, setTool] = useState<ToolId>("bond")
  const [bondStyle, setBondStyle] = useState<BondStyle>({ order: 1, stereo: "none" })
  const [ringKind, setRingKind] = useState<RingKind>("benzene")
  const [atomEl, setAtomEl] = useState("N")
  const [selection, setSelection] = useState<Selection>(emptySelection())
  const [colorHetero, setColorHetero] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
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
    commit(deleteSelection(mol, selection))
  }, [commit, mol, selection])

  const selectEverything = useCallback(() => {
    setSelection(selectAll(mol))
  }, [mol])

  const applyElement = useCallback(
    (el: string) => {
      if (selection.atoms.length > 0) {
        commit(setElement(mol, selection.atoms, el), true)
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
      if (selection.bonds.length > 0) commit(setBondOrder(mol, selection.bonds, order), true)
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
      commit(rotateAtoms(mol, ids, center, angle), true)
    },
    [commit, mol, selection],
  )

  const nudgeSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const ids = atomIdsOfSelection(mol, selection)
      if (ids.length === 0) return
      const dx = direction === "left" ? -10 : direction === "right" ? 10 : 0
      const dy = direction === "up" ? -10 : direction === "down" ? 10 : 0
      commit(moveAtoms(mol, ids, dx, dy), true)
    },
    [commit, mol, selection],
  )

  const tumbleSelection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const ids = atomIdsOfSelection(mol, selection)
      const center = boundsCenter(mol, ids)
      if (!center || ids.length < 2) return
      const angle = Math.PI / 12
      const axis = direction === "left" || direction === "right" ? "y" : "x"
      const sign = direction === "left" || direction === "up" ? 1 : -1
      commit(tumbleAtoms(mol, ids, center, axis, sign * angle), true)
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
      commit(flipAtoms(mol, ids, axis), true)
    },
    [commit, mol, selection],
  )

  const applyCharge = useCallback(
    (delta: number) => {
      if (selection.atoms.length === 0) return
      commit(bumpCharge(mol, selection.atoms, delta), true)
    },
    [commit, mol, selection.atoms],
  )

  const newDocument = useCallback(() => {
    if (mol.atoms.length === 0 && drawing.arrows.length === 0) return
    commitDrawing(emptyDrawing())
  }, [commitDrawing, drawing.arrows.length, mol.atoms.length])

  const formulaSource = selection.atoms.length > 0 ? selection.atoms : undefined
  const formula = plainFormula(mol, formulaSource)

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
    formula: displayFormula(formula),
    weight: formula ? molecularWeight(mol, formulaSource) : 0,
    valenceErrors: valenceErrorCount(mol),
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
  }
}
