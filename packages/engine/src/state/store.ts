import { emptyDrawing } from "@structura/core/drawing"
import { emptyHistory, historyReducer, type History, type HistoryAction } from "@structura/core/history"
import { emptySelection } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
import type { BondStyle, Bracket, Drawing, Molecule, Point, RingKind, Selection } from "@structura/core/types"
import type { CurveFocus } from "../markush/curveEdit.ts"
import type { Run, RunOptions } from "../ops/builders.ts"
import { defaultPick } from "../tools/scaffoldPick.ts"
import type { ScaffoldPick, ToolId, ToolSettings } from "../tools/types.ts"

/** Everything the editor holds, as one immutable snapshot: a new object whenever anything changes. */
export type EditorSnapshot = {
  history: History
  selection: Selection
  tool: ToolId
  bondStyle: BondStyle
  ringKind: RingKind
  atomEl: string
  scaffold: ScaffoldPick
  bracketKind: ToolSettings["bracketKind"]
  attachShape: ToolSettings["attachShape"]
  colorHetero: boolean
  /** Variables' numbers raised as patents print them (R¹), instead of lowered (R₁). */
  raisedNumbers: boolean
  /** The custom attachment curve whose nodes are being edited (and the node picked on it), or null. */
  curveFocus: CurveFocus | null
}

type Update<T> = T | ((now: T) => T)

/** A document that starts out holding these molecules, or this saved drawing, with nothing to undo. */
function startHistory(initial: Molecule[] | Drawing): History {
  const action: HistoryAction = Array.isArray(initial) ? { type: "open", molecules: initial } : { type: "load", drawing: initial }
  return { ...historyReducer(emptyHistory(), action), past: [] }
}

/** The part of a selection whose atoms and bonds the molecule still has. */
function stillThere(selection: Selection, mol: Molecule): Selection {
  const atoms = selection.atoms.filter((id) => mol.atoms.some((atom) => atom.id === id))
  const bonds = selection.bonds.filter((id) => mol.bonds.some((bond) => bond.id === id))
  return atoms.length === selection.atoms.length && bonds.length === selection.bonds.length ? selection : { atoms, bonds }
}

/**
 * The editor's state outside any framework: the document's history, the selection and the
 * tool settings, with the one write path (`run`) and the document actions. Readable at any
 * time (`get`, `latest`), so edits that arrive back to back build on each other; a view
 * re-renders from `subscribe`.
 */
export function createEditorStore(initial: Molecule[] | Drawing = []) {
  let state: EditorSnapshot = {
    history: startHistory(initial),
    selection: emptySelection(),
    tool: "bond",
    bondStyle: { order: 1, stereo: "none" },
    ringKind: "benzene",
    atomEl: "N",
    scaffold: defaultPick("benzene"),
    bracketKind: "group",
    attachShape: null,
    colorHetero: true,
    raisedNumbers: false,
    curveFocus: null,
  }
  const listeners = new Set<() => void>()

  function set(change: Partial<EditorSnapshot>) {
    state = { ...state, ...change }
    for (const listener of listeners) listener()
  }

  const field =
    <K extends keyof EditorSnapshot>(key: K) =>
    (value: Update<EditorSnapshot[K]>) =>
      set({ [key]: typeof value === "function" ? (value as (now: EditorSnapshot[K]) => EditorSnapshot[K])(state[key]) : value } as Partial<EditorSnapshot>)

  /** A history step, with the selection cleared: what it pointed at may be gone. */
  function step(action: HistoryAction) {
    set({ history: historyReducer(state.history, action), selection: emptySelection() })
  }

  /**
   * The one write path: every edit, from a key, a gesture, a menu or an agent, is ops
   * applied to the latest drawing, committed as one undo step. Null if rejected.
   */
  const run: Run = (ops: Op[], options: RunOptions = {}) => {
    const result = applyOps(state.history.present, ops)
    if (!result.ok) {
      options.onReject?.({ index: result.index, error: result.error })
      if (!options.quiet && !options.onReject) console.warn(`edit rejected at op ${result.index}: ${result.error}`)
      return null
    }
    const history = historyReducer(state.history, { type: "commit", drawing: result.drawing })
    // Kept, but only what is still there: a dragged atom that joined another is gone.
    set({ history, selection: options.keepSelection ? stillThere(state.selection, result.drawing.molecule) : emptySelection() })
    return result
  }

  return {
    get: (): EditorSnapshot => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** The drawing as of the last action. */
    latest: (): Drawing => state.history.present,
    run,
    undo: () => step({ type: "undo" }),
    redo: () => step({ type: "redo" }),
    /** Selecting atoms or bonds leaves the curve being edited: keys then act on the selection. */
    setSelection(value: Update<Selection>) {
      const selection = typeof value === "function" ? value(state.selection) : value
      const picked = selection.atoms.length > 0 || selection.bonds.length > 0
      set(picked ? { selection, curveFocus: null } : { selection })
    },
    /** Another tool leaves the curve being edited. */
    setTool: (value: Update<ToolId>) => set({ tool: typeof value === "function" ? value(state.tool) : value, curveFocus: null }),
    setCurveFocus: field("curveFocus"),
    setBondStyle: field("bondStyle"),
    setRingKind: field("ringKind"),
    setAtomEl: field("atomEl"),
    setBracketKind: field("bracketKind"),
    setAttachShape: field("attachShape"),
    setColorHetero: field("colorHetero"),
    setRaisedNumbers: field("raisedNumbers"),
    /** Chooses the scaffold to place, and takes up the template tool. */
    pickScaffold: (pick: ScaffoldPick) => set({ scaffold: pick, tool: "scaffold" }),
    // Opening, importing and starting over replace or extend the document as a whole, so
    // they stay history actions rather than ops; each is still one undoable step.
    /** Replaces the drawing with an opened file's molecules, centred on `at`; `brackets[i]` are molecule i's. */
    openMolecules: (molecules: Molecule[], at?: Point, brackets?: Array<Bracket[] | undefined>) => step({ type: "open", molecules, at, brackets }),
    /** Adds imported molecules beside the drawing as it is when they arrive; round `at` on an empty page. */
    appendMolecules: (molecules: Molecule[], at?: Point, brackets?: Array<Bracket[] | undefined>) => step({ type: "append", molecules, at, brackets }),
    /** Replaces the drawing with a saved Structura document, as one undoable step. */
    loadDrawing: (saved: Drawing) => step({ type: "load", drawing: saved }),
    newDocument() {
      const now = state.history.present
      if (now.molecule.atoms.length === 0 && now.arrows.length === 0) return
      step({ type: "commit", drawing: emptyDrawing() })
    },
  }
}

export type EditorStore = ReturnType<typeof createEditorStore>
