import type { Atom, Bracket, Molecule } from "../types.ts"

// Where a bracket's two uprights stand, worked out from its atoms alone (the file writer
// sits below the renderer, so it cannot ask draw/brackets.ts), close to how the canvas
// draws them: round what the bracket holds, a repeat unit's cutting across the bonds that
// leave it halfway along.

/** A bracket's uprights: "[" at `left`, "]" at `right`, both from `top` to `bottom`. */
export type BracketBox = { left: number; right: number; top: number; bottom: number }

/** Room round the atoms, in bond lengths; more round a labelled atom, whose text reaches further. */
const PAD = 0.35
const LABEL_HALF_WIDTH = 0.3
const LABEL_HALF_HEIGHT = 0.25
/** No bracket is shorter than this, in bond lengths. */
const MIN_HEIGHT = 1.1
/** The least room a repeat bracket keeps from what it holds where a bond runs through it, in bond lengths. */
const NEAR = 0.15
/** How far a repeat bracket reaches past a bond running through it, in bond lengths. */
const OVERHANG = 0.3

/** Where the bond from `inner` to `outer` crosses the upright at `x`, if it does. */
function crossingAt(inner: Atom, outer: Atom, x: number): number | null {
  if ((inner.x - x) * (outer.x - x) > 0 || inner.x === outer.x) return null
  return inner.y + ((outer.y - inner.y) * (x - inner.x)) / (outer.x - inner.x)
}

/**
 * The uprights of `bracket` in `mol`, in drawing units; `labelled` tells which atoms show
 * text. Null when none of its atoms is there.
 */
export function bracketBox(mol: Molecule, bracket: Bracket, bondLength: number, labelled: (atom: Atom) => boolean): BracketBox | null {
  const inside = new Set(bracket.atoms)
  const atoms = mol.atoms.filter((atom) => inside.has(atom.id))
  if (atoms.length === 0) return null
  const reachX = (atom: Atom) => (labelled(atom) ? LABEL_HALF_WIDTH * bondLength : 0)
  const reachY = (atom: Atom) => (labelled(atom) ? LABEL_HALF_HEIGHT * bondLength : 0)
  const content = {
    left: Math.min(...atoms.map((atom) => atom.x - reachX(atom))),
    right: Math.max(...atoms.map((atom) => atom.x + reachX(atom))),
    top: Math.min(...atoms.map((atom) => atom.y - reachY(atom))),
    bottom: Math.max(...atoms.map((atom) => atom.y + reachY(atom))),
  }
  const pad = PAD * bondLength
  const box = { left: content.left - pad, right: content.right + pad, top: content.top - pad, bottom: content.bottom + pad }
  if (bracket.kind === "repeat") {
    // Each upright stands halfway along a bond leaving through its side, as patents draw -[CH2]n-.
    const byId = new Map(mol.atoms.map((atom) => [atom.id, atom]))
    const exits = mol.bonds.flatMap((bond) => {
      if (inside.has(bond.a) === inside.has(bond.b)) return []
      const inner = byId.get(inside.has(bond.a) ? bond.a : bond.b)
      const outer = byId.get(inside.has(bond.a) ? bond.b : bond.a)
      if (!inner || !outer || Math.abs(outer.y - inner.y) > 3.5 * Math.abs(outer.x - inner.x)) return []
      const side = outer.x < content.left ? -1 : outer.x > content.right ? 1 : 0
      return side === 0 ? [] : [{ inner, outer, side, middle: (inner.x + outer.x) / 2 }]
    })
    const near = NEAR * bondLength
    const lefts = exits.filter((exit) => exit.side < 0).map((exit) => exit.middle)
    const rights = exits.filter((exit) => exit.side > 0).map((exit) => exit.middle)
    if (lefts.length > 0) box.left = Math.min(content.left - near, ...lefts)
    if (rights.length > 0) box.right = Math.max(content.right + near, ...rights)
    for (const exit of exits) {
      const y = crossingAt(exit.inner, exit.outer, exit.side < 0 ? box.left : box.right)
      if (y == null) continue
      box.top = Math.min(box.top, y - OVERHANG * bondLength)
      box.bottom = Math.max(box.bottom, y + OVERHANG * bondLength)
    }
  }
  const short = MIN_HEIGHT * bondLength - (box.bottom - box.top)
  if (short > 0) {
    box.top -= short / 2
    box.bottom += short / 2
  }
  return box
}
