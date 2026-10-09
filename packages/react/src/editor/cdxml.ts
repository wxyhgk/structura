import { toCdxml } from "@structura/core/cdxml"
import type { Drawing } from "@structura/core/types"
import { drawOptions } from "./drawOptions.ts"
import { definitionLines } from "./markush/definitions.ts"

/**
 * The drawing as a ChemDraw file (CDXML), labels written as the canvas shows them and a
 * generic formula's definitions as lines of text under it. Used by 导出 CDXML and the
 * host's getCdxml, so both give the same file.
 */
export function drawingCdxml(drawing: Drawing, raisedNumbers: boolean): string {
  return toCdxml(drawing, { notes: definitionLines(drawing), raiseNumbers: drawOptions(raisedNumbers).raiseNumbers })
}
