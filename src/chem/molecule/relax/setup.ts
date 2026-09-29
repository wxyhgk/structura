import { dist } from "../../geometry.ts"
import type { Molecule } from "../../types.ts"
import { componentOf } from "../graph.ts"
import { bondLengthAt } from "../measure.ts"

/**
 * Something that moves as one: a single atom (two coordinates), or a group's atoms as a
 * rigid body (shift plus a turn about its centre, three coordinates).
 */
export type Body = {
  /** Atom indices. */
  members: number[]
  /** Where this body's coordinates start in the parameter vector. */
  offset: number
  rigid: boolean
  cx: number
  cy: number
  /** Turning by this much, times the body's radius, moves its far atoms about as far as a shift would. */
  radius: number
}

/** Everything the relaxer needs, with coordinates in units of the target bond length. */
export type Setup = {
  ids: number[]
  index: Map<number, number>
  /** Start positions, x then y per atom, divided by `unit`. */
  start: Float64Array
  unit: number
  /** Body index per atom, -1 for atoms that stay put. */
  body: Int32Array
  bodies: Body[]
  /** Off for the hidden atoms of a collapsed group: they neither push nor get pushed. */
  visible: Uint8Array
  /** Parameter count. */
  size: number
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** The bond length of the atoms staying put around the moving ones, else the drawing's usual length. */
function targetLength(mol: Molecule, moving: Set<number>): number {
  const around = new Set<number>()
  for (const id of moving) if (!around.has(id)) for (const other of componentOf(mol, id)) around.add(other)
  const index = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  const fixed: number[] = []
  for (const bond of mol.bonds) {
    if (!around.has(bond.a) || moving.has(bond.a) || moving.has(bond.b)) continue
    const a = index.get(bond.a)
    const b = index.get(bond.b)
    if (a && b && dist(a, b) > 1) fixed.push(dist(a, b))
  }
  return median(fixed) ?? bondLengthAt(mol, [...moving][0])
}

/**
 * Decides what moves. A group moves whole, as a rigid body, when its anchor is free and
 * none of its atoms is locked; otherwise all of it stays put.
 */
export function setUp(mol: Molecule, free: Set<number>, locked: Set<number>): Setup | null {
  const moving = new Set([...free].filter((id) => !locked.has(id)))
  const grouped = new Set<number>()
  const rigid: number[][] = []
  const hidden = new Set<number>()
  for (const group of mol.groups) {
    for (const id of group.atoms) grouped.add(id)
    if (group.collapsed) for (const id of group.atoms.slice(1)) hidden.add(id)
    const whole = moving.has(group.atoms[0]) && !group.atoms.some((id) => locked.has(id))
    for (const id of group.atoms) moving.delete(id)
    if (whole) {
      for (const id of group.atoms) moving.add(id)
      rigid.push(group.atoms)
    }
  }
  if (moving.size === 0) return null

  const ids = mol.atoms.map((atom) => atom.id)
  const index = new Map(ids.map((id, at) => [id, at]))
  const unit = targetLength(mol, moving)
  const start = new Float64Array(ids.length * 2)
  mol.atoms.forEach((atom, at) => {
    start[at * 2] = atom.x / unit
    start[at * 2 + 1] = atom.y / unit
  })
  const body = new Int32Array(ids.length).fill(-1)
  const bodies: Body[] = []
  let size = 0
  const addBody = (members: number[], isRigid: boolean) => {
    let cx = 0
    let cy = 0
    for (const at of members) {
      cx += start[at * 2] / members.length
      cy += start[at * 2 + 1] / members.length
    }
    let radius = 0
    for (const at of members) radius = Math.max(radius, Math.hypot(start[at * 2] - cx, start[at * 2 + 1] - cy))
    for (const at of members) body[at] = bodies.length
    bodies.push({ members, offset: size, rigid: isRigid, cx, cy, radius: Math.max(radius, 0.5) })
    size += isRigid ? 3 : 2
  }
  for (const [at, id] of ids.entries()) if (moving.has(id) && !grouped.has(id)) addBody([at], false)
  for (const members of rigid) {
    const indices = members.map((id) => index.get(id)).filter((at) => at != null)
    if (indices.length > 0) addBody(indices, indices.length > 1)
  }
  const visible = Uint8Array.from(ids, (id) => (hidden.has(id) ? 0 : 1))
  return { ids, index, start, unit, body, bodies, visible, size }
}
