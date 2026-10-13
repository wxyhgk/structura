// chem-structura/core: Structura's chemistry without the editor, for a page or a Node program
// that builds, reads, writes, draws or expands structures itself. No React and no browser: in
// Node, label widths are estimated instead of measured. Files come out as the editor writes them.
import { emptySelection } from "@structura/core/molecule"
import { toMolfile } from "@structura/core/molfile"
import type { Drawing } from "@structura/core/types"
import { createEditorStore } from "@structura/engine"
import { drawingCdxml as editorCdxml } from "./editor/cdxml.ts"
import { drawOptions } from "./editor/drawOptions.ts"
import { readMolText } from "./editor/imports/read.ts"
import { pictureSvg } from "./editor/pictureSvg.ts"

export { applyOps, emptyDrawing, isDocument, readDocument, toDocument, validateDrawing } from "@structura/core"
export { displayFormula, elementalAnalysis, exactMass, molecularWeight, netCharge, plainFormula } from "@structura/core"
export { readMolfile, readSdf, toMolfile, toSdf } from "@structura/core"
export { enumerate, enumerationSdf, librarySize } from "@structura/markush"
export type { Arrow, Atom, Bond, Bracket, Drawing, Molecule } from "@structura/core/types"
export type { MolRecord, Op, OpsResult, Problem } from "@structura/core"
export type { EnumerateOptions, Enumeration, LibrarySize } from "@structura/markush"

/** How a drawing is written out, as the editor's 显示 menu sets it. */
export type ExportOptions = {
  /** Variables' numbers raised (R¹) instead of lowered (R₁). Default false. */
  raisedNumbers?: boolean
}

/**
 * Molfile or SD text as a drawing, the way the editor opens a file: several molecules are laid
 * out side by side, brackets come from the Sgroups. `notes` says, in Chinese, what could not be
 * read; with no molecule read, the drawing is empty. Throws only for text that is not a molfile.
 */
export function drawingFromMolfile(text: string): { drawing: Drawing; notes: string[] } {
  const { molecules, brackets, lines } = readMolText(text)
  const store = createEditorStore()
  if (molecules.length > 0) store.openMolecules(molecules, undefined, brackets)
  return { drawing: store.latest(), notes: lines }
}

/** The drawing as molfile text: the molecule with its brackets (as Sgroups); variables' definitions are not in it. */
export function drawingMolfile(drawing: Drawing): string {
  return toMolfile(drawing.molecule, "Structura", drawing.brackets)
}

/** How drawingSvg colours the picture. */
export type SvgLook = {
  /** O, N, Cl… in their own colours (true, the default), or all in `color`. */
  colorHetero?: boolean
  /** The ground: a colour ("#ffffff" by default), or false for none, so the page shows through. */
  background?: string | false
  /**
   * Bonds, carbon and uncoloured labels, arrows: "#222222" by default; "currentColor" takes the
   * page's text colour (dark mode with no filters). Coloured elements keep their colours.
   */
  color?: string
}

/** The drawing as an SVG picture, as 导出 SVG saves it: arrows, variable attachments and brackets included. */
export function drawingSvg(drawing: Drawing, options: ExportOptions & SvgLook = {}): string {
  return pictureSvg(drawing, emptySelection(), options.colorHetero ?? true, drawOptions(options.raisedNumbers ?? false), { background: options.background, ink: options.color })
}

/** The drawing as a ChemDraw file (CDXML), as 导出 CDXML saves it, with a generic formula's definitions as text under it. */
export function drawingCdxml(drawing: Drawing, options: ExportOptions = {}): string {
  return editorCdxml(drawing, options.raisedNumbers ?? false)
}
