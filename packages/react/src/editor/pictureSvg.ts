import { sceneToSvg, type DrawOptions, type SvgOptions } from "@structura/core/draw"
import { bracketsWithin } from "@structura/core/drawing"
import { atomIdsOfSelection, subMolecule } from "@structura/core/molecule"
import type { Drawing, Selection } from "@structura/core/types"

/**
 * What 复制为图片 pictures, as SVG: the selected atoms and bonds when there is a selection,
 * else the whole drawing with its arrows. Variable attachments come along when their atom
 * and all its ring positions are in the picture, brackets when all their atoms are. Empty
 * when there is nothing to draw.
 */
export function pictureSvg(
  drawing: Pick<Drawing, "molecule" | "arrows" | "attachments" | "brackets">,
  selection: Selection,
  colorHetero: boolean,
  options: DrawOptions = {},
  look: Pick<SvgOptions, "background" | "ink"> = {},
): string {
  const ids = atomIdsOfSelection(drawing.molecule, selection)
  if (ids.length === 0) return sceneToSvg(drawing.molecule, colorHetero, drawing.arrows, drawing.attachments, options, { ...look, brackets: drawing.brackets })
  const picked = new Set(ids)
  const attachments = drawing.attachments?.filter((attachment) => picked.has(attachment.atom) && attachment.to.every((id) => picked.has(id)))
  return sceneToSvg(subMolecule(drawing.molecule, ids), colorHetero, [], attachments, options, { ...look, brackets: bracketsWithin(drawing.brackets, ids) })
}
