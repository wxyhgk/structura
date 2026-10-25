import { toCdxml } from "@structura/core/cdxml"
import { embedDocument } from "@structura/core/cdxmlDocument"
import type { Drawing } from "@structura/core/types"
import { drawOptions } from "./drawOptions.ts"
import { definitionLines } from "./markush/definitions.ts"

/**
 * The drawing as a ChemDraw file (CDXML), labels written as the canvas shows them and a
 * generic formula's definitions as lines of text under it: the host's getCdxml, and what
 * 导出 CDXML writes before it adds the document (see drawingCdxmlFile).
 */
export function drawingCdxml(drawing: Drawing, raisedNumbers: boolean): string {
  return toCdxml(drawing, { notes: definitionLines(drawing), raiseNumbers: drawOptions(raisedNumbers).raiseNumbers })
}

/**
 * What 导出 CDXML saves: drawingCdxml with the whole Structura document kept in a comment,
 * so opening the file again brings back what CDXML cannot say (variables' alternatives,
 * provisos, ring closures). Plain CDXML where the browser cannot compress.
 */
export async function drawingCdxmlFile(drawing: Drawing, raisedNumbers: boolean): Promise<string> {
  const cdxml = drawingCdxml(drawing, raisedNumbers)
  try {
    return await embedDocument(cdxml, drawing)
  } catch {
    return cdxml
  }
}
