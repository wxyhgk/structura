import { bondLengthAt } from "../molecule/measure.ts"
import type { Atom, Bracket, Molecule, Point } from "../types.ts"
import type { MarkText } from "./attachments.ts"
import { labelFor, type AtomLabel } from "./labels.ts"
import type { DrawPolyline } from "./primitives.ts"

/** Room between the bracketed atoms (their labels included) and the brackets, in bond lengths. */
const PAD = 0.35
/** How far a bracket's serifs reach inwards, in bond lengths. */
const SERIF = 0.25
/** No bracket is shorter than this, in bond lengths, so one round a single atom still reads as a bracket. */
const MIN_HEIGHT = 1.1
/** How far past a bond running through it a repeat bracket reaches, in bond lengths. */
const OVERHANG = 0.3
/** The count's size, and its gap from "]", in drawing units and bond lengths. */
const COUNT_SIZE = 13
const COUNT_GAP = 0.08

const STROKE = "#222"
const WIDTH = 1.55

type Box = { left: number; right: number; top: number; bottom: number }

/**
 * One bracket as drawn: "[" and "]" as two polylines (a upright with a serif at each end),
 * the count of a repeat unit at the lower right, and how far it all reaches.
 */
export type BracketMark = { id: number; kind: Bracket["kind"]; figures: DrawPolyline[]; text: MarkText | null; box: Box }

/** Where an atom's drawing reaches: its label's box, or the point itself when it has none. */
function extent(atom: Atom, label: AtomLabel | null | undefined): Box {
  return label ? label.box : { left: atom.x, right: atom.x, top: atom.y, bottom: atom.y }
}

/** Where the bond from `inner` to `outer` crosses the upright at `x`, if it does. */
function crossingAt(inner: Point, outer: Point, x: number): number | null {
  if ((inner.x - x) * (outer.x - x) > 0 || inner.x === outer.x) return null
  return inner.y + ((outer.y - inner.y) * (x - inner.x)) / (outer.x - inner.x)
}

/** A bracket's upright at `x` from `top` to `bottom`, its serifs pointing `inward` (+1 right, -1 left). */
function upright(x: number, top: number, bottom: number, inward: number, serif: number): DrawPolyline {
  return {
    kind: "polyline",
    points: [
      { x: x + inward * serif, y: top },
      { x, y: top },
      { x, y: bottom },
      { x: x + inward * serif, y: bottom },
    ],
    stroke: STROKE,
    width: WIDTH,
  }
}

function markOf(mol: Molecule, bracket: Bracket, labelOf: (atom: Atom) => AtomLabel | null | undefined): BracketMark | null {
  const inside = new Set(bracket.atoms)
  const atoms = mol.atoms.filter((atom) => inside.has(atom.id))
  if (atoms.length === 0) return null
  const length = bondLengthAt(mol, atoms[0].id)
  const pad = PAD * length
  const reach = atoms.map((atom) => extent(atom, labelOf(atom)))
  const left = Math.min(...reach.map((box) => box.left)) - pad
  const right = Math.max(...reach.map((box) => box.right)) + pad
  let top = Math.min(...reach.map((box) => box.top)) - pad
  let bottom = Math.max(...reach.map((box) => box.bottom)) + pad
  const short = MIN_HEIGHT * length - (bottom - top)
  if (short > 0) {
    top -= short / 2
    bottom += short / 2
  }
  // A repeat unit's brackets cut across the bonds leaving it, as patents draw -[CH2]n-:
  // each upright reaches past the point where such a bond runs through it.
  if (bracket.kind === "repeat") {
    const byId = new Map(mol.atoms.map((atom) => [atom.id, atom]))
    // Only bonds that leave through the sides: one leaving upwards is not stretched for.
    const [low, high] = [top - 0.5 * length, bottom + 0.5 * length]
    for (const bond of mol.bonds) {
      if (inside.has(bond.a) === inside.has(bond.b)) continue
      const inner = byId.get(inside.has(bond.a) ? bond.a : bond.b)
      const outer = byId.get(inside.has(bond.a) ? bond.b : bond.a)
      if (!inner || !outer) continue
      for (const x of [left, right]) {
        const y = crossingAt(inner, outer, x)
        if (y == null || y < low || y > high) continue
        top = Math.min(top, y - OVERHANG * length)
        bottom = Math.max(bottom, y + OVERHANG * length)
      }
    }
  }
  const serif = SERIF * length
  const figures = [upright(left, top, bottom, 1, serif), upright(right, top, bottom, -1, serif)]
  const name = bracket.kind === "repeat" ? bracket.repeat?.name : undefined
  const text: MarkText | null = name
    ? { text: name, x: right + COUNT_GAP * length, y: bottom - COUNT_SIZE * 0.15, size: COUNT_SIZE, anchor: "start", italic: true, color: STROKE }
    : null
  const textRight = text ? text.x + text.text.length * COUNT_SIZE * 0.6 : right
  return { id: bracket.id, kind: bracket.kind, figures, text, box: { left, right: textRight, top, bottom: Math.max(bottom, text ? text.y + COUNT_SIZE * 0.6 : bottom) } }
}

/**
 * Square brackets as drawn around their atoms: wide and tall enough for the atoms and their
 * labels with some room, a repeat unit's reaching across the bonds that leave it, its count
 * at the lower right. `labels` are the scene's; left out, the bracketed atoms' labels are
 * worked out here. Shared by the canvas, every export and hit-testing, so all agree.
 */
export function bracketMarks(mol: Molecule, brackets: readonly Bracket[] | undefined, labels?: readonly AtomLabel[]): BracketMark[] {
  if (!brackets || brackets.length === 0) return []
  const given = labels && new Map(labels.map((label) => [label.atomId, label]))
  const labelOf = (atom: Atom) => (given ? given.get(atom.id) : labelFor(mol, atom, false))
  return brackets.flatMap((bracket) => markOf(mol, bracket, labelOf) ?? [])
}

/** How far `point` is from a bracket's strokes. */
export function bracketDistance(mark: BracketMark, point: Point): number {
  let best = Infinity
  for (const figure of mark.figures) {
    for (let index = 1; index < figure.points.length; index++) {
      const a = figure.points[index - 1]
      const b = figure.points[index]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
      best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)))
    }
  }
  return best
}
