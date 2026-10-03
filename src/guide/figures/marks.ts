import type { Drawing, Point } from "@structura/core/types"
import { figureSvg } from "./build.ts"

// What a tutorial step shows on top of the structure: where the pointer rests, what is
// selected, where to click or drag, which key to press. Drawn like the editor draws them.

export type Mark =
  /** The blue circle: the pointer rests here (or the hotspot is here), and the next key acts on it. */
  | { kind: "hover"; atom: number }
  /** Selected atoms. */
  | { kind: "select"; atoms: number[] }
  /** Click here (an atom, or a free point). */
  | { kind: "click"; at: number | Point }
  /** Double-click this atom. */
  | { kind: "double"; atom: number }
  /** Press this key, shown by the atom it acts on. */
  | { kind: "key"; key: string; atom: number }
  /** Drag from here to there. */
  | { kind: "drag"; from: number | Point; to: Point }
  /** Drag a selection box over this area. */
  | { kind: "box"; from: Point; to: Point }

const BLUE = "#1a73e8"
type Box = { minX: number; minY: number; maxX: number; maxY: number }

function where(drawing: Drawing, at: number | Point): Point {
  if (typeof at !== "number") return at
  const atom = drawing.molecule.atoms.find((item) => item.id === at)
  return atom ? { x: atom.x, y: atom.y } : { x: 0, y: 0 }
}

/** The points a mark covers, so the picture's frame takes them in. */
function markPoints(drawing: Drawing, mark: Mark): Point[] {
  const pad = (point: Point, r: number) => [
    { x: point.x - r, y: point.y - r },
    { x: point.x + r, y: point.y + r },
  ]
  /** The cursor drawn with its tip at `at` reaches this far right and down. */
  const pointer = (at: Point) => [at, { x: at.x + 17, y: at.y + 24 }]
  switch (mark.kind) {
    case "hover":
      return pad(where(drawing, mark.atom), 14)
    case "double":
      return [...pad(where(drawing, mark.atom), 14), ...pointer(where(drawing, mark.atom))]
    case "select":
      return mark.atoms.flatMap((atom) => pad(where(drawing, atom), 10))
    case "click":
      return [...pad(where(drawing, mark.at), 12), ...pointer(where(drawing, mark.at))]
    case "key":
      return [...pad(where(drawing, mark.atom), 14), { x: where(drawing, mark.atom).x + 26 + mark.key.length * 7, y: where(drawing, mark.atom).y - 36 }]
    case "drag":
      return [...pad(where(drawing, mark.from), 8), ...pad(mark.to, 10), ...pointer(mark.to)]
    case "box":
      return [mark.from, mark.to, ...pointer(mark.to)]
  }
}

/** A cursor arrow with its tip at `at`. */
const cursor = (at: Point) =>
  `<path d="M${at.x} ${at.y} l0 17 l4.5 -4 l3.2 7 l2.6 -1.2 l-3.2 -6.8 l6 0 z" fill="#fff" stroke="#222" stroke-width="1.1" stroke-linejoin="round"/>`

function markSvg(drawing: Drawing, mark: Mark): string {
  switch (mark.kind) {
    case "hover": {
      const at = where(drawing, mark.atom)
      return `<circle cx="${at.x}" cy="${at.y}" r="12" fill="rgba(26,115,232,0.10)" stroke="${BLUE}" stroke-width="1.6"/>`
    }
    case "select":
      return mark.atoms
        .map((atom) => where(drawing, atom))
        .map((at) => `<circle cx="${at.x}" cy="${at.y}" r="8" fill="rgba(26,115,232,0.16)" stroke="${BLUE}" stroke-opacity="0.75" stroke-width="1.2"/>`)
        .join("")
    case "click": {
      const at = where(drawing, mark.at)
      return `<circle cx="${at.x}" cy="${at.y}" r="9" fill="none" stroke="${BLUE}" stroke-width="1.4" stroke-dasharray="2 2"/>${cursor(at)}`
    }
    case "double": {
      const at = where(drawing, mark.atom)
      return `<circle cx="${at.x}" cy="${at.y}" r="9" fill="none" stroke="${BLUE}" stroke-width="1.4"/><circle cx="${at.x}" cy="${at.y}" r="13" fill="none" stroke="${BLUE}" stroke-width="1" stroke-opacity="0.6"/>${cursor(at)}`
    }
    case "key": {
      const at = where(drawing, mark.atom)
      const width = 12 + mark.key.length * 7
      const [x, y] = [at.x + 14, at.y - 32]
      return (
        `<circle cx="${at.x}" cy="${at.y}" r="12" fill="rgba(26,115,232,0.10)" stroke="${BLUE}" stroke-width="1.6"/>` +
        `<line x1="${at.x + 8}" y1="${at.y - 9}" x2="${x + 4}" y2="${y + 18}" stroke="${BLUE}" stroke-width="1"/>` +
        `<rect x="${x}" y="${y}" width="${width}" height="18" rx="3" fill="#fff" stroke="${BLUE}" stroke-width="1.2"/>` +
        `<text x="${x + width / 2}" y="${y + 13}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="${BLUE}">${mark.key}</text>`
      )
    }
    case "drag": {
      const from = where(drawing, mark.from)
      const angle = Math.atan2(mark.to.y - from.y, mark.to.x - from.x)
      const head = (turn: number) => `${mark.to.x - 8 * Math.cos(angle + turn)} ${mark.to.y - 8 * Math.sin(angle + turn)}`
      return (
        `<line x1="${from.x}" y1="${from.y}" x2="${mark.to.x}" y2="${mark.to.y}" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
        `<path d="M${head(0.45)} L${mark.to.x} ${mark.to.y} L${head(-0.45)}" fill="none" stroke="${BLUE}" stroke-width="1.5"/>` +
        cursor(mark.to)
      )
    }
    case "box": {
      const [x, y] = [Math.min(mark.from.x, mark.to.x), Math.min(mark.from.y, mark.to.y)]
      const [w, h] = [Math.abs(mark.to.x - mark.from.x), Math.abs(mark.to.y - mark.from.y)]
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(26,115,232,0.05)" stroke="${BLUE}" stroke-width="1" stroke-dasharray="4 3"/>${cursor(mark.to)}`
    }
  }
}

function boxOf(svg: string): Box | null {
  const match = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg)
  if (!match) return null
  const [x, y, w, h] = match.slice(1).map(Number)
  return { minX: x, minY: y, maxX: x + w, maxY: y + h }
}

const EMPTY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>`

/**
 * One picture per step, all in the same frame, so the structure stays put from step to
 * step and only what changes moves. Each step's marks are drawn on top.
 */
export function stepPictures(steps: Array<{ drawing: Drawing; marks?: Mark[] }>): string[] {
  const svgs = steps.map(({ drawing }) => (drawing.molecule.atoms.length > 0 ? figureSvg(drawing) : EMPTY_SVG))
  const boxes = svgs.map((svg, index) => (steps[index].drawing.molecule.atoms.length > 0 ? boxOf(svg) : null))
  const points = steps.flatMap(({ drawing, marks = [] }) => marks.flatMap((mark) => markPoints(drawing, mark)))
  const all = [...boxes.flatMap((box) => (box ? [{ x: box.minX, y: box.minY }, { x: box.maxX, y: box.maxY }] : [])), ...points]
  if (all.length === 0) return svgs
  const pad = 6
  const frame = {
    minX: Math.min(...all.map((point) => point.x)) - pad,
    minY: Math.min(...all.map((point) => point.y)) - pad,
    maxX: Math.max(...all.map((point) => point.x)) + pad,
    maxY: Math.max(...all.map((point) => point.y)) + pad,
  }
  const [w, h] = [frame.maxX - frame.minX, frame.maxY - frame.minY]
  return svgs.map((svg, index) => {
    const marks = (steps[index].marks ?? []).map((mark) => markSvg(steps[index].drawing, mark)).join("")
    return svg
      .replace(/<svg ([^>]*?)width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `<svg $1width="${w}" height="${h}" viewBox="${frame.minX} ${frame.minY} ${w} ${h}"`)
      .replace(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#fff(?:fff)?"\s*\/>/, `<rect x="${frame.minX}" y="${frame.minY}" width="${w}" height="${h}" fill="#fff"/>`)
      .replace("</svg>", `${marks}</svg>`)
  })
}
