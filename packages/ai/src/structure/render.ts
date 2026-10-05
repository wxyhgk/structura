import { Resvg } from "@resvg/resvg-js"
import { sceneToSvg } from "@structura/core/draw"
import type { Drawing } from "@structura/core/types"

/**
 * The drawing as a PNG data URL for the model to look at, each atom's id written small and
 * grey beside it, so what it sees and the ids it builds with line up. Runs on the server.
 */
export function renderForModel(drawing: Drawing, width = 640): string | null {
  const mol = drawing.molecule
  if (mol.atoms.length === 0) return null
  const ids = mol.atoms
    .map((atom) => `<text x="${atom.x + 7}" y="${atom.y - 7}" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#9a6a00">${atom.id}</text>`)
    .join("")
  const svg = sceneToSvg(mol, true).replace(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/, (_, x, y, w, h) => `viewBox="${+x - 12} ${+y - 12} ${+w + 24} ${+h + 24}"`).replace("</svg>", `${ids}</svg>`)
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "#ffffff" }).render().asPng()
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`
}
