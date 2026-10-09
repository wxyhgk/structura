import { Resvg } from "@resvg/resvg-js"
import { sceneToSvg } from "@structura/core/draw"
import type { Drawing } from "@structura/core/types"

/**
 * The drawing as a PNG data URL for the model to look at, each atom's id written small
 * beside it, and its locant name where it has one (cz.C3), so what it sees and the names it
 * builds with line up. Runs on the server.
 */
export function renderForModel(drawing: Drawing, names: ReadonlyMap<string, number> = new Map(), width = 800): string | null {
  const mol = drawing.molecule
  if (mol.atoms.length === 0) return null
  // The locant (cz.C3) says more than the id; a template's own name (cz) is not an atom label.
  const label = new Map<number, string>()
  for (const [name, id] of names) if (name.includes(".")) label.set(id, label.has(id) ? `${label.get(id)}/${name}` : name)
  const ids = mol.atoms
    .map((atom) => `<text x="${atom.x + 6}" y="${atom.y - 6}" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="#9a6a00">${atom.id}${label.has(atom.id) ? ` ${label.get(atom.id)}` : ""}</text>`)
    .join("")
  // The ids sit up and to the right of their atoms, the locant names trailing further right.
  const svg = sceneToSvg(mol, true, [], undefined, {}, { extraMargin: { left: 16, top: 16, right: 54, bottom: 16 }, overlay: ids })
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "#ffffff" }).render().asPng()
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`
}
