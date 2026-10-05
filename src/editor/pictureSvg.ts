import { sceneToSvg } from "@structura/core/draw"
import { atomIdsOfSelection, subMolecule } from "@structura/core/molecule"
import type { Drawing, Selection } from "@structura/core/types"

/**
 * What 复制为图片 pictures, as SVG: the selected atoms and bonds when there is a selection,
 * else the whole drawing with its arrows. Empty when there is nothing to draw.
 */
export function pictureSvg(drawing: Pick<Drawing, "molecule" | "arrows">, selection: Selection, colorHetero: boolean): string {
  const ids = atomIdsOfSelection(drawing.molecule, selection)
  if (ids.length > 0) return sceneToSvg(subMolecule(drawing.molecule, ids), colorHetero)
  return sceneToSvg(drawing.molecule, colorHetero, drawing.arrows)
}
