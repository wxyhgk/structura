import { BOND_LENGTH, RING_SIZE, SINGLE } from "../constants.ts"
import { pointFrom, signedDelta } from "../geometry.ts"
import type { Molecule, Point, RingKind } from "../types.ts"
import { outwardAngle, sproutAngle } from "./angles.ts"
import { addAtom, addBond, atomById, bondBetween, cloneMolecule, neighbors } from "./graph.ts"
import { kekulizeAromaticReport } from "./kekule.ts"
import { bondLengthAt } from "./measure.ts"
import { sproutAt } from "./place.ts"

export function ringPoints(center: Point, size: number, length = BOND_LENGTH): Point[] {
  const radius = length / (2 * Math.sin(Math.PI / size))
  const points: Point[] = []
  for (let index = 0; index < size; index++) {
    points.push(pointFrom(center, (index * 2 * Math.PI) / size, radius))
  }
  return points
}

export function ringOnBond(a: Point, b: Point, size: number, side: 1 | -1): Point[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || BOND_LENGTH
  const ux = dx / length
  const uy = dy / length
  const apothem = length / (2 * Math.tan(Math.PI / size))
  const radius = length / (2 * Math.sin(Math.PI / size))
  const cx = (a.x + b.x) / 2 + uy * apothem * side
  const cy = (a.y + b.y) / 2 + -ux * apothem * side
  const angleA = Math.atan2(a.y - cy, a.x - cx)
  const angleB = Math.atan2(b.y - cy, b.x - cx)
  const step = Math.sign(signedDelta(angleA, angleB) || 1) * ((2 * Math.PI) / size)
  const points: Point[] = []
  for (let index = 0; index < size; index++) {
    const angle = angleA + index * step
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  }
  points[0] = { x: a.x, y: a.y }
  points[1] = { x: b.x, y: b.y }
  return points
}

/**
 * Adds a ring through `points`, reusing the atoms given in `reuse` (null adds a new
 * carbon), then marks the double bond or the aromatic sextet the ring kind asks for.
 */
export function buildRing(
  mol: Molecule,
  points: Point[],
  kind: RingKind,
  reuse: Array<number | null>,
): { mol: Molecule; ids: number[] } {
  let next = mol
  const ids: number[] = []
  for (let index = 0; index < points.length; index++) {
    const existing = reuse[index]
    if (existing != null) {
      ids.push(existing)
      continue
    }
    const added = addAtom(next, "C", points[index].x, points[index].y)
    next = added.mol
    ids.push(added.id)
  }
  for (let index = 0; index < ids.length; index++) {
    const nextIndex = (index + 1) % ids.length
    const created = addBond(next, ids[index], ids[nextIndex], SINGLE, false)
    if (created) next = created.mol
  }
  if (kind === "cyclopentene") {
    const from = ids[2]
    const to = ids[3 % ids.length]
    const bond = bondBetween(next, from, to)
    if (bond) bond.order = 2
  }
  if (kind === "benzene") {
    next = markAromatic(next, ids)
    next = kekulizeAromaticReport(next, new Set(ids)).mol
  }
  return { mol: next, ids }
}

function markAromatic(mol: Molecule, ids: number[]): Molecule {
  const next = cloneMolecule(mol)
  for (let index = 0; index < ids.length; index++) {
    const a = ids[index]
    const b = ids[(index + 1) % ids.length]
    const bond = bondBetween(next, a, b)
    if (bond) bond.aromatic = true
  }
  return next
}

export function placeRing(mol: Molecule, center: Point, kind: RingKind): Molecule {
  const points = ringPoints(center, RING_SIZE[kind], bondLengthAt(mol))
  return buildRing(
    mol,
    points,
    kind,
    points.map(() => null),
  ).mol
}

/** Ring hung off an atom by one extra single bond. */
function ringAttachedPoints(origin: Point, angle: number, size: number, length = BOND_LENGTH): Point[] {
  const radius = length / (2 * Math.sin(Math.PI / size))
  const ipso = pointFrom(origin, angle, length)
  const center = pointFrom(ipso, angle, radius)
  const points: Point[] = []
  for (let index = 0; index < size; index++) {
    points.push(pointFrom(center, angle + Math.PI + (index * 2 * Math.PI) / size, radius))
  }
  points[0] = ipso
  return points
}

export function attachRing(mol: Molecule, atomId: number, kind: RingKind): Molecule {
  return attachRingAt(mol, atomId, kind).mol
}

export function attachRingAt(
  mol: Molecule,
  atomId: number,
  kind: RingKind,
  angle = sproutAngle(mol, atomId),
): { mol: Molecule; ipso: number; far: number } {
  const atom = atomById(mol, atomId)
  if (!atom) return { mol, ipso: atomId, far: atomId }
  const size = RING_SIZE[kind]
  const points = ringAttachedPoints(atom, angle, size, bondLengthAt(mol, atomId))
  const built = buildRing(
    mol,
    points,
    kind,
    points.map(() => null),
  )
  const linked = addBond(built.mol, atomId, built.ids[0], SINGLE)
  return {
    mol: linked?.mol ?? built.mol,
    ipso: built.ids[0],
    far: built.ids[Math.floor(size / 2)] ?? built.ids[0],
  }
}

/** The given atom is vertex 0. The ring center lies further along `angle`. */
export function ringThroughPoints(origin: Point, angle: number, size: number, length = BOND_LENGTH): Point[] {
  const radius = length / (2 * Math.sin(Math.PI / size))
  const center = pointFrom(origin, angle, radius)
  const points: Point[] = []
  for (let index = 0; index < size; index++) {
    points.push(pointFrom(center, angle + Math.PI + (index * 2 * Math.PI) / size, radius))
  }
  points[0] = { x: origin.x, y: origin.y }
  return points
}

export function spiroRing(
  mol: Molecule,
  atomId: number,
  kind: RingKind,
  angle = sproutAngle(mol, atomId),
): { mol: Molecule; far: number } {
  const atom = atomById(mol, atomId)
  if (!atom) return { mol, far: atomId }
  const size = RING_SIZE[kind]
  const points = ringThroughPoints(atom, angle, size, bondLengthAt(mol, atomId))
  const built = buildRing(
    mol,
    points,
    kind,
    points.map((_, index) => (index === 0 ? atomId : null)),
  )
  return { mol: built.mol, far: built.ids[Math.floor(size / 2)] ?? atomId }
}

/**
 * One ring from an atom, shared by the ring tool and the hover keys.
 * A singly bonded atom becomes a ring carbon. Benzene on a more substituted
 * atom sprouts one carbon and puts that carbon in the ring. A saturated ring
 * on a more substituted atom is spiro.
 */
export function growRing(mol: Molecule, atomId: number, kind: RingKind): { mol: Molecule; far: number } {
  const count = neighbors(mol, atomId).length
  if (count >= 2 && kind === "benzene") {
    const link = sproutAt(mol, atomId, sproutAngle(mol, atomId), SINGLE, "C")
    return spiroRing(link.mol, link.id, kind, outwardAngle(link.mol, link.id))
  }
  if (count >= 2) return spiroRing(mol, atomId, kind)
  return spiroRing(mol, atomId, kind, outwardAngle(mol, atomId))
}

export function growRingPreview(
  mol: Molecule,
  atomId: number,
  kind: RingKind,
): { points: Point[]; anchor?: Point } {
  const atom = atomById(mol, atomId)
  if (!atom) return { points: [] }
  const size = RING_SIZE[kind]
  const count = neighbors(mol, atomId).length
  const length = bondLengthAt(mol, atomId)
  if (count >= 2 && kind === "benzene") {
    const angle = sproutAngle(mol, atomId)
    const link = pointFrom(atom, angle, length)
    return { points: ringThroughPoints(link, angle, size, length), anchor: atom }
  }
  if (count >= 2) return { points: ringThroughPoints(atom, sproutAngle(mol, atomId), size, length) }
  return { points: ringThroughPoints(atom, outwardAngle(mol, atomId), size, length) }
}
