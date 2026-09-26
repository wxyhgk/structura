import { emptyDrawing } from "./drawing.ts"
import type { Drawing, Molecule } from "./types.ts"

export type History = {
  past: Drawing[]
  present: Drawing
  future: Drawing[]
}

export type HistoryAction =
  | { type: "commit"; drawing: Drawing }
  | { type: "commit-molecule"; mol: Molecule }
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
  if (action.type === "commit" || action.type === "commit-molecule") {
    const drawing = action.type === "commit" ? action.drawing : { ...state.present, molecule: action.mol }
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
