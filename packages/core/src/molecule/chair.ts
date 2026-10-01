import { BOND_LENGTH, SINGLE } from "../constants.ts"
import { pointFrom } from "../geometry.ts"
import type { Molecule } from "../types.ts"
import { sproutAngle } from "./angles.ts"
import { addBond, atomById, bondById } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"
import { buildRing } from "./rings.ts"

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
