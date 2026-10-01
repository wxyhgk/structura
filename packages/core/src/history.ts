import { emptyDrawing } from "./drawing.ts"
import { placeBeside, sideBySide } from "./molecule/arrange.ts"
import type { Drawing, Molecule, Point } from "./types.ts"

export type History = {
  past: Drawing[]
  present: Drawing
  future: Drawing[]
}

export type HistoryAction =
  | { type: "commit"; drawing: Drawing }
  | { type: "commit-molecule"; mol: Molecule }
  /** Replaces the drawing with these molecules side by side (opening a file), centred on `at`. */
  | { type: "open"; molecules: Molecule[]; at?: Point }
  /** Adds these molecules beside whatever is drawn when the action lands (paste, SMILES); round `at` on an empty page. */
  | { type: "append"; molecules: Molecule[]; at?: Point }
  /** Replaces the drawing with a saved one, as it was saved (opening a Structura file). */
  | { type: "load"; drawing: Drawing }
  | { type: "undo" }
  | { type: "redo" }

const LIMIT = 100

export function emptyHistory(): History {
  return { past: [], present: emptyDrawing(), future: [] }
}

/**
 * Carries the id counters forward onto a snapshot so an id is never handed out twice,
 * even after undo, redo or a new document brings back an older counter.
 */
export function keepCounters(drawing: Drawing, current: Drawing): Drawing {
  const mol = drawing.molecule
  const nextAtomId = Math.max(mol.nextAtomId, current.molecule.nextAtomId)
  const nextBondId = Math.max(mol.nextBondId, current.molecule.nextBondId)
  const nextGroupId = Math.max(mol.nextGroupId, current.molecule.nextGroupId)
  const nextArrowId = Math.max(drawing.nextArrowId, current.nextArrowId)
  if (
    nextAtomId === mol.nextAtomId &&
    nextBondId === mol.nextBondId &&
    nextGroupId === mol.nextGroupId &&
    nextArrowId === drawing.nextArrowId
  ) {
    return drawing
  }
  return { ...drawing, molecule: { ...mol, nextAtomId, nextBondId, nextGroupId }, nextArrowId }
}

export function historyReducer(state: History, action: HistoryAction): History {
  // Imports finish asynchronously, so they merge into the drawing as it is now, not as
  // it was when they started; otherwise edits made meanwhile would be overwritten.
  if (action.type === "open" || action.type === "append") {
    if (action.molecules.length === 0) return state
    const current = state.present
    const drawing =
      action.type === "open"
        ? { molecule: sideBySide(action.molecules, current.molecule, action.at), arrows: [], nextArrowId: current.nextArrowId }
        : { ...current, molecule: placeBeside(current.molecule, action.molecules, action.at) }
    return historyReducer(state, { type: "commit", drawing })
  }
  if (action.type === "commit" || action.type === "commit-molecule" || action.type === "load") {
    const drawing = action.type === "commit-molecule" ? { ...state.present, molecule: action.mol } : action.drawing
    return {
      past: [...state.past, state.present].slice(-LIMIT),
      present: keepCounters(drawing, state.present),
      future: [],
    }
  }
  if (action.type === "undo") {
    const previous = state.past.at(-1)
    if (!previous) return state
    return {
      past: state.past.slice(0, -1),
      present: keepCounters(previous, state.present),
      future: [state.present, ...state.future],
    }
  }
  const next = state.future[0]
  if (!next) return state
  return {
    past: [...state.past, state.present],
    present: keepCounters(next, state.present),
    future: state.future.slice(1),
  }
}
