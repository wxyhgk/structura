import { SINGLE } from "../constants.ts"
import { angleTo } from "../geometry.ts"
import { setAtomLabel } from "../label.ts"
import { addAtom, atomById, attachRingAt, bondsLeaving, centroidOf, deleteSelection, neighbors, placeRing, relax, sproutAt } from "../molecule.ts"
import { BRIDGES, bridge } from "../markush/bridges.ts"
import { placeFragment } from "../markush/fragments.ts"
import { RECIPES } from "../molecule/recipes.ts"
import type { Molecule, Point } from "../types.ts"
import { OpError, type Context, type Step } from "./context.ts"
import type { Op, Replacement } from "./types.ts"

/** What a replacement builds, and the atom it starts from (the one bonded to the rest). */
type Built = { mol: Molecule; head: number }

/** The pieces that hang off one atom (a bond or a bridge joins two instead). */
type Hanging = Exclude<Replacement, { bond: true } | { bridge: unknown } | { fragment: unknown }>

/** The atom `before` did not have that is now bonded to `anchor`: where a grown piece starts. */
function newNeighbour(before: Molecule, after: Molecule, anchor: number): number {
  const id = neighbors(after, anchor).find((atom) => !atomById(before, atom.id))?.id
  if (id == null) throw new OpError(`nothing new is bonded to atom #${anchor}`)
  return id
}

/** The replacement grown from `anchor`, pointing along `angle` where the piece allows it. */
function growFrom(mol: Molecule, anchor: number, angle: number, piece: Hanging): Built {
  if ("label" in piece) {
    const grown = sproutAt(mol, anchor, angle, SINGLE, "C")
    return { mol: setAtomLabel(grown.mol, grown.id, piece.label), head: grown.id }
  }
  if ("ring" in piece) {
    // Bonded on, never spiro: the ring takes the old fragment's place.
    const ring = attachRingAt(mol, anchor, piece.ring, angle)
    if (ring.mol === mol) throw new OpError(`no room for ${piece.ring} on atom #${anchor}`)
    return { mol: ring.mol, head: ring.ipso }
  }
  if (!Object.hasOwn(RECIPES, piece.recipe)) {
    throw new OpError(`"${piece.recipe}" is not a known recipe (${Object.keys(RECIPES).join(", ")})`)
  }
  const built = RECIPES[piece.recipe](mol, anchor)
  if (built.mol === mol) throw new OpError(`"${piece.recipe}" could not be built on atom #${anchor}`)
  return { mol: built.mol, head: newNeighbour(mol, built.mol, anchor) }
}

/** The replacement standing on its own where the old fragment was. */
function placeAt(mol: Molecule, at: Point, piece: Hanging): Built {
  if ("label" in piece) {
    const placed = addAtom(mol, "C", at.x, at.y)
    return { mol: setAtomLabel(placed.mol, placed.id, piece.label), head: placed.id }
  }
  if ("ring" in piece) {
    const ring = placeRing(mol, at, piece.ring)
    return { mol: ring, head: ring.atoms.find((atom) => !atomById(mol, atom.id))!.id }
  }
  throw new OpError("a recipe is built on an atom; replace a fragment that hangs off something")
}

/** A fragment joined by exactly two bonds, replaced by a direct bond or a divalent bridge between its neighbours. */
function linkAcross(mol: Molecule, op: Extract<Op, { op: "replace" }>, ids: Set<number>, joins: Molecule["bonds"], ctx: Context): Step {
  if (joins.length !== 2) throw new OpError(`a bond or a bridge replaces a fragment joined by two bonds, not ${joins.length}`)
  const piece = "bridge" in op.with ? op.with.bridge : "bond"
  if (piece !== "bond" && !Object.hasOwn(BRIDGES, piece)) throw new OpError(`unknown bridge "${piece}" (${Object.keys(BRIDGES).join(", ")})`)
  const [a, b] = joins.map((bond) => (ids.has(bond.a) ? bond.b : bond.a))
  if (a === b) throw new OpError("both bonds lead to the same atom")
  const toward = centroidOf(mol, [...ids])!
  const without = deleteSelection(mol, { atoms: [...ids], bonds: [] })
  const joined = bridge(without, a, b, piece, toward)
  const added = joined.atoms.filter((atom) => !atomById(without, atom.id)).map((atom) => atom.id)
  ctx.name(op.as, added[0] ?? a)
  return { mol: joined, next: null }
}

/**
 * Swaps a fragment for another piece. A fragment hanging off the rest by one bond is
 * rebuilt on the same atom, pointing the way the old one did; a free-standing one is
 * replaced where it stood. Only the new atoms are then tidied; nothing else moves.
 */
export function replaceFragment(mol: Molecule, op: Extract<Op, { op: "replace" }>, ctx: Context): Step {
  if ("label" in op.with && (/[\r\n]/.test(op.with.label) || !op.with.label.trim() || op.with.label.trim().length > 32)) {
    throw new OpError("a label is one line of 1 to 32 characters")
  }
  const ids = new Set(op.atoms.map(ctx.atom))
  if (ids.size === 0) throw new OpError("give the atoms to replace")
  const joins = bondsLeaving(mol, ids)
  if ("bond" in op.with || "bridge" in op.with) return linkAcross(mol, op, ids, joins, ctx)
  if ("fragment" in op.with) {
    if (ids.size !== 1) throw new OpError("a drawn piece replaces one placeholder atom")
    const placed = placeFragment(mol, [...ids][0], op.with.fragment)
    if ("error" in placed) throw new OpError(placed.error)
    ctx.name(op.as, placed.head)
    return { mol: placed.mol, next: null }
  }
  const piece: Hanging = op.with
  if (joins.length > 1) {
    throw new OpError(`the fragment is joined to the rest by ${joins.length} bonds; only a fragment joined by one bond (or none) can be replaced, or one joined by two with a bond or a bridge`)
  }
  const without = deleteSelection(mol, { atoms: [...ids], bonds: [] })
  let built: Built
  if (joins.length === 1) {
    const [join] = joins
    const anchor = ids.has(join.a) ? join.b : join.a
    const inside = ids.has(join.a) ? join.a : join.b
    built = growFrom(without, anchor, angleTo(atomById(mol, anchor)!, atomById(mol, inside)!), piece)
  } else {
    built = placeAt(without, centroidOf(mol, [...ids])!, piece)
  }
  const added = built.mol.atoms.filter((atom) => !atomById(without, atom.id)).map((atom) => atom.id)
  const tidied = added.length > 0 ? relax(built.mol, { atoms: added }) : built.mol
  const head = atomById(tidied, built.head) ? built.head : added[0]
  ctx.name(op.as, head)
  return { mol: tidied, next: head != null ? { type: "atom", id: head } : null }
}
