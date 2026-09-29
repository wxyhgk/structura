import { angleTo, pointFrom } from "../../geometry.ts"
import type { Molecule, Point } from "../../types.ts"
import { smallestRings } from "../cycles.ts"
import { atomById, cloneMolecule, neighbors } from "../graph.ts"
import { bondLengthAt } from "../measure.ts"

/** Nearer than this many bond lengths to an atom it is not bonded to, an atom is misplaced. */
const CROWDED = 0.5

type Ring = { members: Set<number>; centre: Point; radius: number }

function ringsOf(mol: Molecule): Ring[] {
  return smallestRings(mol).map((ids) => {
    const atoms = ids.map((id) => atomById(mol, id)!)
    const centre = {
      x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length,
      y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length,
    }
    const radius = Math.min(...atoms.map((atom) => Math.hypot(atom.x - centre.x, atom.y - centre.y)))
    return { members: new Set(ids), centre, radius }
  })
}

/** The middle of the widest gap between the settled neighbours of `hub`, seen from `hub`. */
function widestGap(mol: Molecule, hub: number, settled: Set<number>, skip: number): number {
  const at = atomById(mol, hub)!
  const angles = neighbors(mol, hub)
    .filter((other) => other.id !== skip && settled.has(other.id))
    .map((other) => angleTo(at, other))
    .sort((a, b) => a - b)
  if (angles.length === 0) return 0
  if (angles.length === 1) return angles[0] + (2 * Math.PI) / 3
  let best = { size: -1, mid: 0 }
  for (const [index, angle] of angles.entries()) {
    const next = index + 1 < angles.length ? angles[index + 1] : angles[0] + 2 * Math.PI
    if (next - angle > best.size) best = { size: next - angle, mid: (angle + next) / 2 }
  }
  return best.mid
}

/**
 * A first, coarse pass before the relaxer: gradient steps can never carry a substituent
 * across a ring bond, so one that starts inside a ring, or on top of another atom, stays
 * trapped. Walking out from the atoms that stay put (and from ring atoms), each free atom
 * found inside a ring or on an atom already walked past is set down one bond length out
 * along the widest gap of the atom it hangs from, and the rest of its branch comes with it.
 * Wedge ends are left alone so no stereo meaning flips.
 */
export function unfold(mol: Molecule, free: Set<number>, keep: Set<number>): Molecule {
  const rings = ringsOf(mol)
  const inRing = new Set(rings.flatMap((ring) => [...ring.members]))
  const movable = (id: number) => free.has(id) && !inRing.has(id) && !keep.has(id)
  if (!mol.atoms.some((atom) => movable(atom.id))) return mol

  const next = cloneMolecule(mol)
  const length = bondLengthAt(mol)
  const settled = new Set(next.atoms.filter((atom) => !movable(atom.id)).map((atom) => atom.id))

  const misplaced = (id: number) => {
    const atom = atomById(next, id)!
    const bonded = new Set(neighbors(next, id).map((other) => other.id))
    if (rings.some((ring) => !ring.members.has(id) && Math.hypot(atom.x - ring.centre.x, atom.y - ring.centre.y) < ring.radius * 0.8)) return true
    // Of two atoms on top of each other, the one reached later gives way.
    return next.atoms.some(
      (other) => settled.has(other.id) && !bonded.has(other.id) && Math.hypot(other.x - atom.x, other.y - atom.y) < CROWDED * length,
    )
  }

  /** The unsettled atoms reached from `start` without passing through settled ones. */
  const branch = (start: number): number[] => {
    const seen = new Set([start])
    const stack = [start]
    while (stack.length > 0) {
      for (const other of neighbors(next, stack.pop()!)) {
        if (settled.has(other.id) || seen.has(other.id)) continue
        seen.add(other.id)
        stack.push(other.id)
      }
    }
    return [...seen]
  }

  const queue = [...settled]
  for (;;) {
    // A piece with nothing settled in it (a free chain) grows from its lowest id.
    if (queue.length === 0) {
      const seed = next.atoms.find((atom) => !settled.has(atom.id))
      if (!seed) break
      settled.add(seed.id)
      queue.push(seed.id)
    }
    const hub = queue.shift()!
    for (const other of neighbors(next, hub)) {
      if (settled.has(other.id)) continue
      if (misplaced(other.id)) {
        const hubAtom = atomById(next, hub)!
        const target = pointFrom(hubAtom, widestGap(next, hub, settled, other.id), length)
        const dx = target.x - other.x
        const dy = target.y - other.y
        for (const id of branch(other.id)) {
          const atom = atomById(next, id)!
          atom.x += dx
          atom.y += dy
        }
      }
      settled.add(other.id)
      queue.push(other.id)
    }
  }
  return next
}
