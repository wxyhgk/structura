import type { Arrow, Attachment, Molecule } from "../types.ts"
import { displayMolecule } from "../molecule/collapse.ts"
import { attachmentMarks, markTextExtent, type MarkText } from "./attachments.ts"
import type { AtomLabel, DrawOptions } from "./labels.ts"
import type { Figure } from "./primitives.ts"
import { buildScene } from "./scene.ts"

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function figureSvg(figure: Figure): string {
  if (figure.kind === "line") {
    const dash = figure.dash ? ` stroke-dasharray="${figure.dash}"` : ""
    return `<line x1="${figure.x1.toFixed(2)}" y1="${figure.y1.toFixed(2)}" x2="${figure.x2.toFixed(2)}" y2="${figure.y2.toFixed(2)}" stroke="${figure.stroke}" stroke-width="${figure.width}" stroke-linecap="${figure.cap ?? "butt"}"${dash}/>`
  }
  if (figure.kind === "polygon") {
    const points = figure.points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
    return `<polygon points="${points}" fill="${figure.fill}"/>`
  }
  const points = figure.points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
  return `<polyline points="${points}" fill="none" stroke="${figure.stroke}" stroke-width="${figure.width}" stroke-linejoin="round" stroke-linecap="round"/>`
}

function labelSvg(label: AtomLabel): string {
  return label.runs
    .map(
      (run) =>
        `<text x="${run.x.toFixed(2)}" y="${run.y.toFixed(2)}" fill="${label.color}" font-family="Arial, Helvetica, sans-serif" font-size="${run.size}" text-anchor="${run.anchor}" dominant-baseline="central">${escapeXml(run.text)}</text>`,
    )
    .join("")
}

function markTextSvg(text: MarkText): string {
  const italic = text.italic ? ` font-style="italic"` : ""
  return `<text x="${text.x.toFixed(2)}" y="${text.y.toFixed(2)}" fill="${text.color}" font-family="Arial, Helvetica, sans-serif" font-size="${text.size.toFixed(2)}"${italic} text-anchor="${text.anchor}" dominant-baseline="central">${escapeXml(text.text)}</text>`
}

/**
 * The molecule as a standalone SVG, with its arrows and a generic formula's variable points
 * of attachment ("(R1)m" included), fitted with a margin on a white ground.
 */
export function sceneToSvg(molecule: Molecule, colorHetero: boolean, arrowList: Arrow[] = [], attachments?: readonly Attachment[], options: DrawOptions = {}): string {
  if (molecule.atoms.length === 0) return ""
  // Fitted around what is shown: atoms behind a collapsed label take no room.
  const mol = displayMolecule(molecule)
  const scene = buildScene(mol, colorHetero, options)
  const marks = attachmentMarks(mol, attachments, scene.labels)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const atom of mol.atoms) {
    minX = Math.min(minX, atom.x)
    minY = Math.min(minY, atom.y)
    maxX = Math.max(maxX, atom.x)
    maxY = Math.max(maxY, atom.y)
  }
  for (const label of scene.labels) {
    minX = Math.min(minX, label.box.left)
    minY = Math.min(minY, label.box.top)
    maxX = Math.max(maxX, label.box.right)
    maxY = Math.max(maxY, label.box.bottom)
  }
  for (const mark of marks) {
    for (const extent of [{ left: mark.to.x, right: mark.to.x, top: mark.to.y, bottom: mark.to.y }, ...mark.texts.map(markTextExtent)]) {
      minX = Math.min(minX, extent.left)
      minY = Math.min(minY, extent.top)
      maxX = Math.max(maxX, extent.right)
      maxY = Math.max(maxY, extent.bottom)
    }
  }
  for (const arrow of arrowList) {
    minX = Math.min(minX, arrow.x1, arrow.x2)
    minY = Math.min(minY, arrow.y1, arrow.y2)
    maxX = Math.max(maxX, arrow.x1, arrow.x2)
    maxY = Math.max(maxY, arrow.y1, arrow.y2)
  }
  const pad = 18
  const x = minX - pad
  const y = minY - pad
  const width = Math.max(1, maxX - minX + pad * 2)
  const height = Math.max(1, maxY - minY + pad * 2)
  const arrows = arrowList
    .map((arrow) => {
      const dx = arrow.x2 - arrow.x1
      const dy = arrow.y2 - arrow.y1
      const length = Math.hypot(dx, dy) || 1
      const ux = dx / length
      const uy = dy / length
      const head = 9
      const wingA = `${(arrow.x2 - ux * head - uy * 4).toFixed(2)},${(arrow.y2 - uy * head + ux * 4).toFixed(2)}`
      const wingB = `${(arrow.x2 - ux * head + uy * 4).toFixed(2)},${(arrow.y2 - uy * head - ux * 4).toFixed(2)}`
      return `<line x1="${arrow.x1.toFixed(2)}" y1="${arrow.y1.toFixed(2)}" x2="${arrow.x2.toFixed(2)}" y2="${arrow.y2.toFixed(2)}" stroke="#222" stroke-width="1.6"/><polygon points="${arrow.x2.toFixed(2)},${arrow.y2.toFixed(2)} ${wingA} ${wingB}" fill="#222"/>`
    })
    .join("")
  const attached = marks
    .map(
      (mark) =>
        `<line x1="${mark.from.x.toFixed(2)}" y1="${mark.from.y.toFixed(2)}" x2="${mark.to.x.toFixed(2)}" y2="${mark.to.y.toFixed(2)}" stroke="#222" stroke-width="1.55" stroke-linecap="round"/>` +
        mark.texts.map(markTextSvg).join(""),
    )
    .join("")
  const body = scene.figures.map(figureSvg).join("") + scene.labels.map(labelSvg).join("") + attached + arrows
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(1)}" height="${height.toFixed(1)}" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}">\n<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="#ffffff"/>\n${body}\n</svg>\n`
}
