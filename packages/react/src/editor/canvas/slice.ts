import type { EditorSlice } from "./types.ts"

/** What a canvas takes from an editor's state and actions, whichever editor drives it. */
export type CanvasSource = Pick<EditorSlice, "arrows" | "tool" | "bondStyle" | "ringKind" | "scaffold" | "atomEl" | "bracketKind" | "attachShape" | "selection" | "colorHetero" | "run" | "latest" | "setSelection" | "undo">

/**
 * A canvas's props: the editor's state and actions, with what this canvas shows on its own
 * (the molecule as drawn, how labels are written, attachments, brackets) and its view.
 */
export function canvasSlice(source: CanvasSource, shown: Pick<EditorSlice, "mol" | "drawOptions" | "attachments" | "brackets" | "viewport">): EditorSlice {
  return {
    arrows: source.arrows,
    tool: source.tool,
    bondStyle: source.bondStyle,
    ringKind: source.ringKind,
    scaffold: source.scaffold,
    atomEl: source.atomEl,
    bracketKind: source.bracketKind,
    attachShape: source.attachShape,
    selection: source.selection,
    colorHetero: source.colorHetero,
    run: source.run,
    latest: source.latest,
    setSelection: source.setSelection,
    undo: source.undo,
    ...shown,
  }
}
