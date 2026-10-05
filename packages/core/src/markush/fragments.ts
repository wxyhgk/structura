import { hydrogenCount, plainFormula } from "../formula.ts"
import { knownLabel } from "../label.ts"
import { addBond, atomById, bondLengthAt, bondOrderSum, componentOf, deleteSelection, neighbors, relax, spliceIn, subMolecule } from "../molecule.ts"
import { ringMembership } from "../molecule/cycles.ts"
import type { Bond, Molecule, Point } from "../types.ts"
import { errorsOf, validate } from "../validate.ts"
import { isVariableName } from "./names.ts"

// Drawn pieces as a variable's alternatives: the label "*" marks where a piece joins the
// formula, and placing one puts it where the placeholder was, bonded the way it was.

/** The label that marks a piece's point of attachment. */
export const STAR = "*"

/** Most atoms a piece may have; a patent's groups are far smaller. */
const MOST_ATOMS = 300

/** A piece's "*" atoms in id order, each with the atom bonded to it: the one that takes that bond. */
export function fragmentEnds(piece: Molecule): Array<{ star: number; head: number }> {
  return piece.atoms
    .filter((atom) => atom.alias === STAR)
    .sort((a, b) => a.id - b.id)
    .map((star) => ({ star: star.id, head: neighbors(piece, star.id)[0]?.id ?? -1 }))
}

/** Why a drawn piece cannot be an alternative, or null. */
export function fragmentProblem(piece: Molecule): string | null {
  if (piece.atoms.length > MOST_ATOMS) return `a piece has at most ${MOST_ATOMS} atoms, not ${piece.atoms.length}`
  const broken = errorsOf(validate(piece))
  if (broken.length > 0) return `the piece is not a valid molecule: ${broken[0].message}`
  const ends = fragmentEnds(piece)
  if (ends.length === 0) return 'mark where the piece joins the formula with an atom labelled "*"'
  if (ends.length > 2) return `a piece joins the formula at one or two "*" atoms, not ${ends.length}`
  for (const { star } of ends) {
    const around = neighbors(piece, star)
    if (around.length !== 1 || around[0].alias === STAR) return 'each "*" is bonded to exactly one atom of the piece'
    if (piece.bonds.some((bond) => (bond.a === star || bond.b === star) && bond.order !== 1)) return 'a "*" is joined by a single bond'
  }
  if (componentOf(piece, ends[0].star).length !== piece.atoms.length) return "the piece is in one piece: every atom joined to the rest"
  const odd = piece.atoms.find((atom) => atom.alias && atom.alias !== STAR && !knownLabel(atom.alias) && !isVariableName(atom.alias))
  if (odd) return `"${odd.alias}" in the piece is no element, abbreviation or variable`
  return null
}

/** The piece without its "*" marks, as a molecule of its own. */
function body(piece: Molecule): Molecule {
  return subMolecule(piece, piece.atoms.filter((atom) => atom.alias !== STAR).map((atom) => atom.id))
}

/**
 * "C12H8N": the piece's formula, for showing it by name. Labelled atoms (the "*" marks and
 * inner placeholders) are not counted, but their bonds are, so no hydrogen fills their place.
 */
export function fragmentFormula(piece: Molecule): string {
  return plainFormula(piece)
}

/** The bonds of `site` with the atom each leads to, in bond order. */
function linksOf(mol: Molecule, site: number): Array<{ bond: Bond; other: number }> {
  return mol.bonds
    .filter((bond) => bond.a === site || bond.b === site)
    .sort((a, b) => a.id - b.id)
    .map((bond) => ({ bond, other: bond.a === site ? bond.b : bond.a }))
}

/**
 * Whether the piece can take the placeholder's place: one head takes all its bonds (with
 * room for them in its valence), or, between two atoms outside a ring, two heads one each.
 */
export function fragmentFits(mol: Molecule, site: number, piece: Molecule): boolean {
  const links = linksOf(mol, site)
  const ends = fragmentEnds(piece)
  const heads = [...new Set(ends.map((end) => end.head))]
  const room = (head: number, order: number) => {
    const atom = atomById(piece, head)
    if (!atom || atom.alias) return true
    const stars = ends.filter((end) => end.head === head).length
    return !hydrogenCount(atom.el, atom.charge, bondOrderSum(piece, head) - stars + order).error
  }
  if (heads.length === 2) return links.length === 2 && !ringMembership(mol).count.has(site) && heads.every((head) => room(head, 1))
  if (ends.length !== 1 && ends.length !== links.length) return false
  return room(heads[0], links.reduce((sum, link) => sum + link.bond.order, 0))
}

type Turn = (point: Point) => Point

/** Turns, scales and moves points so that `from` lands on `to`, turned by `angle`. */
function turn(from: Point, angle: number, scale: number, to: Point): Turn {
  const [cos, sin] = [Math.cos(angle) * scale, Math.sin(angle) * scale]
  return (point) => {
    const [dx, dy] = [point.x - from.x, point.y - from.y]
    return { x: to.x + cos * dx - sin * dy, y: to.y + sin * dx + cos * dy }
  }
}

const angleOf = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x)
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const at = (mol: Molecule, id: number): Point => atomById(mol, id)!

/** The piece's atoms (its "*" marks left out) put into `mol` where `place` says; the new ids by old. */
function splice(mol: Molecule, piece: Molecule, place: Turn): { mol: Molecule; ids: Map<number, number> } {
  const moved = body(piece)
  moved.atoms = moved.atoms.map((atom) => ({ ...atom, ...place(atom) }))
  const spliced = spliceIn(mol, moved, 0, 0)
  return { mol: spliced.mol, ids: new Map(moved.atoms.map((atom, index) => [atom.id, spliced.ids[index]])) }
}

/** A bond like `bond` between `from` and the new `to`, keeping a wedge only if it started at `from`. */
function rejoin(mol: Molecule, bond: Bond, from: number, to: number): Molecule {
  const stereo = bond.a === from ? bond.stereo : "none"
  return addBond(mol, from, to, { order: bond.order, stereo, look: bond.look })?.mol ?? mol
}

/** The placed piece: the molecule, the new atoms, the atom that took the bond, and each piece atom's new id. */
export type Placed = { mol: Molecule; added: number[]; head: number; ids: Map<number, number> }

/**
 * Puts the piece where the placeholder atom `site` is, bonded the way it was. A piece with
 * one head takes every bond on that head, turned so its "*" marks point at the atoms it
 * joins and the rest of it points away. A piece with two heads joins the two atoms a linker
 * sits between: the larger side stays, the smaller is carried to where the far "*" lies.
 */
export function placeFragment(mol: Molecule, site: number, piece: Molecule): Placed | { error: string } {
  const problem = fragmentProblem(piece)
  if (problem) return { error: problem }
  if (!atomById(mol, site)) return { error: `there is no atom #${site}` }
  if (!fragmentFits(mol, site, piece)) return { error: `the piece does not fit where atom #${site} sits` }
  const ends = fragmentEnds(piece)
  return new Set(ends.map((end) => end.head)).size === 2 ? placeBetween(mol, site, piece, ends) : placeOnOne(mol, site, piece, ends)
}

function placeOnOne(mol: Molecule, site: number, piece: Molecule, ends: ReturnType<typeof fragmentEnds>): Placed {
  const links = linksOf(mol, site)
  const centre = at(mol, site)
  const head = at(piece, ends[0].head)
  const length = bondLengthAt(mol, site)
  const scale = length / dist(head, at(piece, ends[0].star))
  // Candidate turns: the line between the "*" marks onto the line between the neighbours
  // (either way round), or a single "*" onto the neighbours' mean direction.
  const angles: number[] = []
  if (ends.length === 2) {
    const base = angleOf(at(mol, links[1].other), at(mol, links[0].other)) - angleOf(at(piece, ends[1].star), at(piece, ends[0].star))
    angles.push(base, base + Math.PI)
  } else {
    const mean = links.reduce((sum, link) => ({ x: sum.x + at(mol, link.other).x - centre.x, y: sum.y + at(mol, link.other).y - centre.y }), { x: 0, y: 0 })
    angles.push(Math.atan2(mean.y, mean.x) - angleOf(head, at(piece, ends[0].star)))
  }
  // The turn that leaves the rest of the piece farthest from the atoms it joins.
  const rest = body(piece).atoms.filter((atom) => atom.id !== ends[0].head)
  const clearance = (angle: number) => {
    const place = turn(head, angle, scale, centre)
    return rest.reduce((sum, atom) => sum + Math.min(...links.map((link) => dist(place(atom), at(mol, link.other)))), 0)
  }
  const angle = angles.reduce((best, next) => (clearance(next) > clearance(best) ? next : best))
  let { mol: next, ids } = splice(mol, piece, turn(head, angle, scale, centre))
  const newHead = ids.get(ends[0].head)!
  for (const { bond, other } of links) next = rejoin(next, bond, other, newHead)
  next = deleteSelection(next, { atoms: [site], bonds: [] })
  const added = [...ids.values()]
  const free = added.filter((id) => id !== newHead)
  if (free.length > 0) next = relax(next, { atoms: free, locked: [newHead] })
  return { mol: next, added, head: newHead, ids }
}

function placeBetween(mol: Molecule, site: number, piece: Molecule, ends: ReturnType<typeof fragmentEnds>): Placed {
  const links = linksOf(mol, site)
  const centre = at(mol, site)
  const without = deleteSelection(mol, { atoms: [site], bonds: [] })
  const sides = links.map((link) => componentOf(without, link.other))
  // The larger side stays put.
  const [fixed, moving] = sides[0].length >= sides[1].length ? [0, 1] : [1, 0]
  const length = bondLengthAt(mol, site)
  const plans = [ends, [ends[1], ends[0]]].map(([toFixed, toMoving]) => {
    const anchor = at(mol, links[fixed].other)
    const away = angleOf(anchor, centre)
    // The head one bond out from the fixed atom toward where the placeholder was, its "*" on that atom.
    const spot = { x: anchor.x + Math.cos(away) * length, y: anchor.y + Math.sin(away) * length }
    const head = at(piece, toFixed.head)
    const star = at(piece, toFixed.star)
    const place = turn(head, angleOf(spot, anchor) - angleOf(head, star), length / dist(head, star), spot)
    const target = place(at(piece, toMoving.star))
    return { toFixed, toMoving, place, target, cost: dist(target, at(mol, links[moving].other)) }
  })
  const plan = plans[0].cost <= plans[1].cost ? plans[0] : plans[1]
  let { mol: next, ids } = splice(without, piece, plan.place)
  const movingAtom = links[moving].other
  const sameSide = sides[moving].includes(links[fixed].other)
  if (!sameSide) {
    const from = at(next, movingAtom)
    const [dx, dy] = [plan.target.x - from.x, plan.target.y - from.y]
    const carried = new Set(sides[moving])
    next = { ...next, atoms: next.atoms.map((atom) => (carried.has(atom.id) ? { ...atom, x: atom.x + dx, y: atom.y + dy } : atom)) }
  }
  next = rejoin(next, links[fixed].bond, links[fixed].other, ids.get(plan.toFixed.head)!)
  next = rejoin(next, links[moving].bond, movingAtom, ids.get(plan.toMoving.head)!)
  const rest = sides[moving].filter((id) => id !== movingAtom)
  if (!sameSide && rest.length > 0) next = relax(next, { atoms: rest, locked: [movingAtom] })
  return { mol: next, added: [...ids.values()], head: ids.get(plan.toFixed.head)!, ids }
}

/**
 * The selected atoms as a piece of their own, ready to be an alternative: ids from 1 and
 * centred on the origin. Bonds leaving the selection are dropped; groups wholly inside kept.
 */
export function fragmentFrom(mol: Molecule, atoms: number[]): Molecule {
  const picked = subMolecule(mol, atoms)
  const ids = new Map(picked.atoms.map((atom, index) => [atom.id, index + 1]))
  const xs = picked.atoms.map((atom) => atom.x)
  const ys = picked.atoms.map((atom) => atom.y)
  const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  return {
    atoms: picked.atoms.map((atom) => ({ ...atom, id: ids.get(atom.id)!, x: atom.x - cx, y: atom.y - cy })),
    bonds: picked.bonds.map((bond, index) => ({ ...bond, id: index + 1, a: ids.get(bond.a)!, b: ids.get(bond.b)! })),
    groups: picked.groups.map((group, index) => ({ ...group, id: index + 1, atoms: group.atoms.map((id) => ids.get(id)!) })),
    nextAtomId: picked.atoms.length + 1,
    nextBondId: picked.bonds.length + 1,
    nextGroupId: picked.groups.length + 1,
  }
}

/** Placeholder labels inside a piece (R5 in N–R5), in drawing order. */
export function fragmentVariables(piece: Molecule): string[] {
  return [...new Set(piece.atoms.flatMap((atom) => (atom.alias && atom.alias !== STAR && isVariableName(atom.alias) ? [atom.alias] : [])))]
}
