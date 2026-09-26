import { ATOM_HIT, BOND_LENGTH, RING_SIZE, SINGLE, SNAP_ATOM, SNAP_CHAIN } from "../constants.ts"
import { angleTo, dist, distToSegment, norm, pointFrom, sideOfLine, signedDelta } from "../geometry.ts"
import type { Bond, BondStyle, Molecule, Point, RingKind } from "../types.ts"
import { addAtom, addBond, atomById, bondById, bondOrderSum, cloneMolecule, componentOf, neighbors, setElement, subMolecule } from "./graph.ts"
import { kekulizeAromaticReport } from "./kekule.ts"
import { nearestAtom } from "./snap.ts"

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function bondLengths(mol: Molecule, atoms?: Set<number>): number[] {
  const lengths: number[] = []
  for (const bond of mol.bonds) {
    if (atoms && !atoms.has(bond.a)) continue
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (a && b) lengths.push(dist(a, b))
  }
  return lengths.filter((length) => length > 1)
}

/**
 * The bond length for new atoms next to `atomId`: the median bond of its piece of the
 * drawing, so bonds, rings and groups added to a scaled structure match it. Without an
 * atom it is the median of the whole drawing; with no bonds at all, the default.
 */
export function bondLengthAt(mol: Molecule, atomId?: number): number {
  if (atomId != null) {
    const local = median(bondLengths(mol, new Set(componentOf(mol, atomId))))
    if (local != null) return local
  }
  return median(bondLengths(mol)) ?? BOND_LENGTH
}

export function sproutAngle(mol: Molecule, atomId: number): number {
  const atom = atomById(mol, atomId)
  if (!atom) return 0
  const bonded = neighbors(mol, atomId)
  if (bonded.length === 0) return 0
  if (bonded.length === 1) {
    const parent = bonded[0]
    const incoming = angleTo(parent, atom)
    const earlier = neighbors(mol, parent.id).filter((item) => item.id !== atomId)
    if (earlier.length === 0) return norm(incoming + Math.PI / 3)
    const previous = angleTo(earlier[0], parent)
    const lastTurn = signedDelta(previous, incoming)
    return norm(incoming - lastTurn)
  }
  const angles = bonded.map((item) => angleTo(atom, item)).sort((a, b) => a - b)
  let bestGap = -1
  let best = 0
  for (let index = 0; index < angles.length; index++) {
    const start = angles[index]
    const end = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0)
    const gap = end - start
    if (gap > bestGap) {
      bestGap = gap
      best = start + gap / 2
    }
  }
  return norm(best)
}

/** Continue straight through a singly bonded atom, away from its neighbor. */
export function outwardAngle(mol: Molecule, atomId: number): number {
  const atom = atomById(mol, atomId)
  const bonded = neighbors(mol, atomId)
  if (!atom || bonded.length !== 1) return sproutAngle(mol, atomId)
  return angleTo(bonded[0], atom)
}

export function createBondAt(mol: Molecule, origin: Point, style: BondStyle, el = "C"): Molecule {
  const end = pointFrom(origin, 0, bondLengthAt(mol))
  const first = addAtom(mol, el, origin.x, origin.y)
  const second = addAtom(first.mol, el, end.x, end.y)
  return addBond(second.mol, first.id, second.id, style)?.mol ?? second.mol
}

export function sprout(mol: Molecule, atomId: number, style: BondStyle, el = "C"): Molecule {
  return sproutAt(mol, atomId, sproutAngle(mol, atomId), style, el).mol
}

export function sproutAt(
  mol: Molecule,
  atomId: number,
  angle: number,
  style: BondStyle,
  el = "C",
  charge = 0,
): { mol: Molecule; id: number } {
  const atom = atomById(mol, atomId)
  if (!atom) return { mol, id: atomId }
  const point = pointFrom(atom, angle, bondLengthAt(mol, atomId))
  const near = nearestAtom(mol, point, ATOM_HIT, atomId)
  if (near) {
    const bonded = addBond(mol, atomId, near.id, style)
    return { mol: bonded?.mol ?? mol, id: near.id }
  }
  const added = addAtom(mol, el, point.x, point.y, charge)
  const bonded = addBond(added.mol, atomId, added.id, style)
  return { mol: bonded?.mol ?? added.mol, id: added.id }
}

export function connectPoints(
  mol: Molecule,
  fromId: number | null,
  origin: Point,
  end: Point,
  style: BondStyle,
  el = "C",
): Molecule {
  const target = nearestAtom(mol, end, SNAP_ATOM, fromId ?? undefined)
  if (fromId == null) {
    const startNear = nearestAtom(mol, origin, ATOM_HIT)
    const start = startNear ? { mol, id: startNear.id } : addAtom(mol, el, origin.x, origin.y)
    if (target && target.id !== start.id) {
      return addBond(start.mol, start.id, target.id, style)?.mol ?? start.mol
    }
    const added = addAtom(start.mol, el, end.x, end.y)
    return addBond(added.mol, start.id, added.id, style)?.mol ?? added.mol
  }
  if (target) return addBond(mol, fromId, target.id, style)?.mol ?? mol
  const added = addAtom(mol, el, end.x, end.y)
  return addBond(added.mol, fromId, added.id, style)?.mol ?? added.mol
}

export function placeAtom(mol: Molecule, el: string, point: Point): Molecule {
  const near = nearestAtom(mol, point, ATOM_HIT)
  if (near) return setElement(mol, [near.id], el)
  return addAtom(mol, el, point.x, point.y).mol
}

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

function buildRing(
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
    const bond = next.bonds.find(
      (item) => (item.a === from && item.b === to) || (item.a === to && item.b === from),
    )
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
    const bond = next.bonds.find(
      (item) => (item.a === a && item.b === b) || (item.a === b && item.b === a),
    )
    if (bond) bond.aromatic = true
  }
  return next
}

/** Other ring around a bond, not using the bond itself. Empty when the bond is a chain. */
export function cycleAround(mol: Molecule, bond: Bond): number[] | null {
  const start = bond.a
  const goal = bond.b
  const previous = new Map<number, number | null>([[start, null]])
  const depth = new Map<number, number>([[start, 0]])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) break
    const currentDepth = depth.get(current) ?? 0
    if (currentDepth >= 7) continue
    for (const neighbor of neighbors(mol, current)) {
      if (current === start && neighbor.id === goal) continue
      if (previous.has(neighbor.id)) continue
      previous.set(neighbor.id, current)
      depth.set(neighbor.id, currentDepth + 1)
      if (neighbor.id === goal) {
        const path: number[] = []
        let cursor: number | null = goal
        while (cursor != null) {
          path.push(cursor)
          cursor = previous.get(cursor) ?? null
        }
        path.reverse()
        return path.length >= 3 && path.length <= 8 ? path : null
      }
      queue.push(neighbor.id)
    }
  }
  return null
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

export function fuseRing(mol: Molecule, bondId: number, kind: RingKind, side: 1 | -1): Molecule {
  return fuseRingAt(mol, bondId, kind, side).mol
}

export function fuseRingAt(
  mol: Molecule,
  bondId: number,
  kind: RingKind,
  side: 1 | -1,
): { mol: Molecule; far: number } {
  const bond = bondById(mol, bondId)
  if (!bond) return { mol, far: 0 }
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return { mol, far: bond.a }
  const plan = planFusion(mol, bond, kind, side)
  if (!plan) return { mol, far: bond.a }
  const built = buildRing(mol, plan.points, kind, plan.reuse)
  const far = built.ids[Math.floor(RING_SIZE[kind] / 2)] ?? a.id
  return { mol: built.mol, far }
}

/** Ring hung off an atom by one extra single bond. */
export function ringAttachedPoints(origin: Point, angle: number, size: number, length = BOND_LENGTH): Point[] {
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

const CHAIR: Array<[number, number]> = [
  [0, 0],
  [22, -33],
  [78, -33],
  [100, 0],
  [78, 33],
  [22, 33],
]

export function attachChairAt(
  mol: Molecule,
  atomId: number,
  turn: 1 | -1,
): { mol: Molecule; far: number } {
  const atom = atomById(mol, atomId)
  if (!atom) return { mol, far: atomId }
  const angle = sproutAngle(mol, atomId)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const length = bondLengthAt(mol, atomId)
  const scale = length / BOND_LENGTH
  const ipso = pointFrom(atom, angle, length)
  const points = CHAIR.map(([lx, ly]) => {
    const localY = ly * turn * scale
    const localX = lx * scale
    return {
      x: ipso.x + localX * cos + localY * sin,
      y: ipso.y - localX * sin + localY * cos,
    }
  })
  const built = buildRing(
    mol,
    points,
    "cyclohexane",
    points.map(() => null),
  )
  const linked = addBond(built.mol, atomId, built.ids[0], SINGLE)
  return { mol: linked?.mol ?? built.mol, far: built.ids[3] ?? built.ids[0] }
}

/** Chair whose first edge lies on an existing bond. `turn` mirrors it across that bond. */
export function fuseChairAt(
  mol: Molecule,
  bondId: number,
  turn: 1 | -1,
): { mol: Molecule; far: number } {
  const bond = bondById(mol, bondId)
  if (!bond) return { mol, far: 0 }
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return { mol, far: bond.a }
  const local = CHAIR.map(([x, y]) => [x, y * turn] as [number, number])
  const ox = local[0][0]
  const oy = local[0][1]
  const ex = local[1][0] - ox
  const ey = local[1][1] - oy
  const edge = Math.hypot(ex, ey) || 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy) || 1
  const scale = span / edge
  const cos = (ex * dx + ey * dy) / (edge * span)
  const sin = (ex * dy - ey * dx) / (edge * span)
  const points = local.map(([x, y]) => {
    const vx = (x - ox) * scale
    const vy = (y - oy) * scale
    return { x: a.x + vx * cos - vy * sin, y: a.y + vx * sin + vy * cos }
  })
  const built = buildRing(
    mol,
    points,
    "cyclohexane",
    points.map((_, index) => (index === 0 ? a.id : index === 1 ? b.id : null)),
  )
  return { mol: built.mol, far: built.ids[3] ?? a.id }
}

export function chainPoints(origin: Point, axis: number, count: number, length = BOND_LENGTH): Point[] {
  const points = [origin]
  let cursor = origin
  for (let index = 0; index < count; index++) {
    const angle = axis + (index % 2 === 0 ? 1 : -1) * (Math.PI / 6)
    cursor = pointFrom(cursor, angle, length)
    points.push(cursor)
  }
  return points
}

export function chainCount(distance: number, length = BOND_LENGTH): number {
  const step = length * Math.cos(Math.PI / 6)
  if (distance < length * 0.45) return 1
  return Math.max(1, Math.round(distance / step))
}

export function commitChain(mol: Molecule, points: Point[], fromId: number | null): Molecule {
  let next = mol
  let previous = fromId
  const start = fromId == null ? 0 : 1
  for (let index = start; index < points.length; index++) {
    const near = nearestAtom(next, points[index], SNAP_CHAIN, previous ?? undefined)
    let id: number
    if (near && near.id !== previous) {
      id = near.id
    } else {
      const added = addAtom(next, "C", points[index].x, points[index].y)
      next = added.mol
      id = added.id
    }
    if (previous != null) {
      const bonded = addBond(next, previous, id, SINGLE, false)
      if (bonded) next = bonded.mol
    }
    previous = id
  }
  return next
}

const COINCIDENT = 0.8

function bonded(mol: Molecule, a: number, b: number): boolean {
  return mol.bonds.some((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))
}

/**
 * Vertices that land on an existing atom are reused. That is how a third
 * ring closes across the bay of naphthalene: the new hexagon shares the
 * bridgehead and both neighboring carbons, instead of giving the bridgehead
 * another bond.
 */
function planFusion(
  mol: Molecule,
  bond: Bond,
  kind: RingKind,
  side: 1 | -1,
): { points: Point[]; reuse: Array<number | null> } | null {
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return null
  const points = ringOnBond(a, b, RING_SIZE[kind], openSide(mol, bond, side))
  const reuse: Array<number | null> = points.map((point, index) => {
    if (index === 0) return bond.a
    if (index === 1) return bond.b
    let best: number | null = null
    let bestDistance = COINCIDENT
    for (const atom of mol.atoms) {
      const distance = dist(point, atom)
      if (distance <= bestDistance) {
        best = atom.id
        bestDistance = distance
      }
    }
    return best
  })
  if (new Set(reuse.filter((id) => id != null)).size !== reuse.filter((id) => id != null).length) return null
  const extra = new Map<number, number>()
  let adds = false
  for (let index = 0; index < reuse.length; index++) {
    const left = reuse[index]
    const right = reuse[(index + 1) % reuse.length]
    if (left != null && right != null && bonded(mol, left, right)) continue
    adds = true
    if (left != null) extra.set(left, (extra.get(left) ?? 0) + 1)
    if (right != null) extra.set(right, (extra.get(right) ?? 0) + 1)
  }
  if (!adds) return null
  for (const [id, count] of extra) {
    const atom = atomById(mol, id)
    if (!atom) return null
    const room = atom.el === "C" ? 4 - Math.abs(atom.charge) : 8
    if (bondOrderSum(mol, id) + count > room) return null
  }
  return { points, reuse }
}

function canFuse(mol: Molecule, bond: Bond, kind: RingKind): boolean {
  return planFusion(mol, bond, kind, 1) != null
}

/** Nearest bond that can accept a fused ring. Bridgehead atoms are skipped. */
export function fusionTarget(mol: Molecule, point: Point, kind: RingKind, radius: number): Bond | null {
  let best: Bond | null = null
  let bestDistance = radius
  for (const bond of mol.bonds) {
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (!a || !b) continue
    const distance = distToSegment(point, a, b)
    // Distance is cheap and rules out almost every bond; only then ask whether it can fuse.
    if (distance <= bestDistance && canFuse(mol, bond, kind)) {
      best = bond
      bestDistance = distance
    }
  }
  return best
}

/** How far from a bond the pointer still counts as fusing a ring of this size. */
export function fuseReach(size: number, length = BOND_LENGTH): number {
  const apothem = length / (2 * Math.tan(Math.PI / size))
  return apothem + 4
}

export function fuseSide(mol: Molecule, bond: Bond, point: Point): 1 | -1 {
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return 1
  return sideOfLine(a, b, point)
}

/** Side of a ring bond that does not already contain the ring. A chain bond keeps the requested side. */
function openSide(mol: Molecule, bond: Bond, preferred: 1 | -1): 1 | -1 {
  const cycle = cycleAround(mol, bond)
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!cycle || !a || !b) return preferred
  let x = 0
  let y = 0
  let count = 0
  for (const id of cycle) {
    const atom = atomById(mol, id)
    if (!atom) continue
    x += atom.x
    y += atom.y
    count += 1
  }
  if (count === 0) return preferred
  const occupied = sideOfLine(a, b, { x: x / count, y: y / count })
  return occupied === 1 ? -1 : 1
}

export function fusionSide(mol: Molecule, bond: Bond, point: Point): 1 | -1 {
  return openSide(mol, bond, fuseSide(mol, bond, point))
}

/**
 * Copies the given atoms (and the bonds and groups among them) to the right of where
 * they are, two bond lengths clear, with fresh ids. Returns the copy's atom ids.
 */
export function duplicateAtoms(mol: Molecule, atomIds: number[]): { mol: Molecule; ids: number[] } {
  const piece = subMolecule(mol, atomIds)
  if (piece.atoms.length === 0) return { mol, ids: [] }
  const xs = piece.atoms.map((atom) => atom.x)
  const dx = Math.max(...xs) - Math.min(...xs) + bondLengthAt(mol, piece.atoms[0].id) * 2
  const next = cloneMolecule(mol)
  const ids = new Map<number, number>()
  for (const atom of piece.atoms) {
    const id = next.nextAtomId++
    ids.set(atom.id, id)
    next.atoms.push({ ...atom, id, x: atom.x + dx })
  }
  for (const bond of piece.bonds) {
    next.bonds.push({ ...bond, id: next.nextBondId++, a: ids.get(bond.a) ?? 0, b: ids.get(bond.b) ?? 0 })
  }
  for (const group of piece.groups) {
    next.groups.push({ ...group, id: next.nextGroupId++, atoms: group.atoms.map((id) => ids.get(id) ?? 0) })
  }
  return { mol: next, ids: [...ids.values()] }
}
