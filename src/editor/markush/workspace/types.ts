import type { Drawing, Molecule } from "@structura/core/types"
import type { Run } from "@structura/engine"
import type { GuideTopic } from "@/guide"

/** Which of the editor's two workspaces is showing: drawing, or the generic formula and what it generates. */
export type Workspace = "draw" | "markush"

/** What every pane of the generic-formula workspace works from: the one document, and the way to change it. */
export type WorkspaceProps = {
  /** The drawing as of the last edit: the formula with its variables, attachments, provisos and ring closures. */
  drawing: Drawing
  /** Applies ops to the document as one undoable step (the same write path as the canvas). */
  run: Run
  /** The atoms selected on the formula's canvas. */
  selected: number[]
  colorHetero: boolean
  /** The document's file name without extension, for exports. */
  base: string
  /** Puts a generated compound on the drawing (beside the formula) and switches back to drawing. */
  onPlace: (mol: Molecule) => void
  /** Opens the user guide on a page. */
  onHelp: (topic: GuideTopic) => void
  /** Opens 从专利文字填写; absent when the host has no way to reach a model. */
  onFill?: () => void
}
