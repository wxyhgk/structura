import type { Molecule } from "../types.ts"
import { atomById, cloneMolecule, cycleAround, neighbors } from "../molecule/graph.ts"
import { objective, positionsFor } from "./relax/energy.ts"
import { minimize } from "./relax/minimize.ts"
import { setUp } from "./relax/setup.ts"
import { buildSprings } from "./relax/springs.ts"
import { unfold } from "./relax/unfold.ts"

export type RelaxOptions = {
  /** The atoms allowed to move. Every other atom stays exactly where it is. */
  atoms: Iterable<number>
  /** Atoms that stay put even when listed in `atoms`. */
  locked?: Iterable<number>
  /** Cap on minimiser steps. */
  iterations?: number
}

/**
 * How a wedge's start atom sees its neighbours; if this changes, the wedge means the other
 * stereoisomer. Two neighbours: which side one is of the other. Three: the sign of the
 * volume they span, each wedged one lifted off the page (up +1, down -1), which is how a
 * reader turns the drawing into a configuration: with one wedge, the turn from one plain
 * neighbour to the other. Their order round the atom is not enough, since it can stay the
 * same while that turn reverses. Four or more: their order round the atom.
 */
export function handedness(mol: Molecule, centre: number): string {
  const atom = atomById(mol, centre)
  const around = neighbors(mol, centre)
  if (!atom || around.length < 2) return ""
  if (around.length === 2) {
    const [a, b] = around
    return Math.sign((a.x - atom.x) * (b.y - atom.y) - (a.y - atom.y) * (b.x - atom.x)).toString()
  }
  if (around.length === 3) {
    // Lifted by its own length, so the volume over the three lengths is a sine-like -1…1.
    const vector = (item: { id: number; x: number; y: number }) => {
      const bond = mol.bonds.find((other) => other.a === centre && other.b === item.id)
      const flat = Math.hypot(item.x - atom.x, item.y - atom.y)
      return [item.x - atom.x, item.y - atom.y, bond?.stereo === "up" ? flat : bond?.stereo === "down" ? -flat : 0]
    }
    const [p, q, r] = [...around].sort((a, b) => a.id - b.id).map(vector)
    const volume = p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])
    const scale = [p, q, r].reduce((product, v) => product * Math.hypot(v[0], v[1], v[2]), 1)
    // Next to flat (two plain neighbours in a straight line), a reader could take it either
    // way: "?" holds the centre still rather than risk tipping it.
    return scale > 0 && Math.abs(volume / scale) > AMBIGUOUS ? `v${Math.sign(volume)}` : "?"
  }
  const order = [...around].sort((a, b) => Math.atan2(a.y - atom.y, a.x - atom.x) - Math.atan2(b.y - atom.y, b.x - atom.x)).map((item) => item.id)
  const start = order.indexOf(Math.min(...order))
  return [...order.slice(start), ...order.slice(0, start)].join(",")
}

/** How close to flat (as a sine) a three-neighbour centre may be and still be read one way. */
const AMBIGUOUS = 0.1

/** Which side of a double bond each atom beyond it lies on: if this changes, E becomes Z. */
function doubleBondSides(mol: Molecule, a: number, b: number): string {
  const p = atomById(mol, a)
  const q = atomById(mol, b)
  if (!p || !q) return ""
  const side = (id: number) => {
    const r = atomById(mol, id)!
    return Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  }
  return [a, b].map((end) => neighbors(mol, end).filter((other) => other.id !== a && other.id !== b).map((other) => `${other.id}:${side(other.id)}`).join(",")).join("|")
}

/**
 * What the drawing says about stereochemistry, each with the atoms to hold still when it
 * would change: every wedge's start atom, and every double bond outside a small ring with
 * atoms beyond both ends.
 */
function stereoMarks(mol: Molecule): Array<{ read: (mol: Molecule) => string; hold: number[] }> {
  const centres = [...new Set(mol.bonds.filter((bond) => bond.stereo === "up" || bond.stereo === "down").map((bond) => bond.a))]
  const wedges = centres.map((id) => ({ read: (m: Molecule) => handedness(m, id), hold: [id, ...neighbors(mol, id).map((other) => other.id)] }))
  const doubles = mol.bonds
    // In a ring of eight or fewer a double bond can only be cis: there is nothing to keep (and
    // a chain just closed into a ring must be free to bend into it).
    .filter((bond) => bond.order === 2 && !cycleAround(mol, bond) && [bond.a, bond.b].every((end) => neighbors(mol, end).length > 1))
    .map((bond) => ({ read: (m: Molecule) => doubleBondSides(m, bond.a, bond.b), hold: [bond.a, bond.b, ...[bond.a, bond.b].flatMap((end) => neighbors(mol, end).map((other) => other.id))] }))
  return [...wedges, ...doubles]
}

function relaxOnce(mol: Molecule, free: Set<number>, locked: Set<number>, iterations: number): Molecule {
  const setup = setUp(mol, free, locked)
  if (!setup) return mol
  const { springs, close } = buildSprings(mol, setup)
  const f = objective(setup, springs, close)
  const q = minimize(f, new Float64Array(setup.size), { iterations, tolerance: 1e-5, maxStep: 0.25 })
  const pos = positionsFor(setup, q)
  const next = cloneMolecule(mol)
  for (const atom of next.atoms) {
    const at = setup.index.get(atom.id)!
    if (setup.body[at] < 0) continue
    atom.x = pos[at * 2] * setup.unit
    atom.y = pos[at * 2 + 1] * setup.unit
  }
  return next
}

/**
 * Tidies part of a drawing: the free atoms move towards even bond lengths, ideal angles
 * and regular rings, away from atoms they overlap, while staying near where they were.
 * Atoms trapped inside a ring or on top of another atom are first set back outside (see
 * unfold), since small steps alone cannot carry them across a ring bond.
 * Nothing else moves, groups move whole, and no wedge or hash, and no double bond, comes to
 * mean the other stereoisomer: a centre or double bond that would flip is held still, with
 * its neighbours, and the clean-up is run again.
 */
export function relax(mol: Molecule, options: RelaxOptions): Molecule {
  const free = new Set([...options.atoms].filter((id) => atomById(mol, id)))
  const locked = new Set(options.locked ?? [])
  const iterations = options.iterations ?? 300
  const marks = stereoMarks(mol)
  const wedged = new Set(mol.bonds.filter((bond) => bond.stereo === "up" || bond.stereo === "down").flatMap((bond) => [bond.a, ...neighbors(mol, bond.a).map((other) => other.id)]))
  const before = marks.map((mark) => mark.read(mol))
  // A wedge drawn so that it could be read either way stays exactly as drawn.
  marks.forEach((mark, at) => {
    if (before[at] === "?") for (const id of mark.hold) locked.add(id)
  })
  // Setting trapped atoms back outside must not tip a double bond either: one that it would
  // is held while it is done.
  const held = new Set([...locked, ...wedged])
  let unfolded = unfold(mol, free, held)
  const tipped = marks.filter((mark, at) => mark.read(unfolded) !== before[at])
  if (tipped.length > 0) {
    for (const mark of tipped) for (const id of mark.hold) held.add(id)
    unfolded = unfold(mol, free, held)
  }
  mol = unfolded

  for (let round = 0; round < 3; round++) {
    const next = relaxOnce(mol, free, locked, iterations)
    const flipped = marks.filter((mark, at) => mark.read(next) !== before[at])
    if (flipped.length === 0) return next
    for (const mark of flipped) for (const id of mark.hold) locked.add(id)
  }
  for (const mark of marks) for (const id of mark.hold) locked.add(id)
  return relaxOnce(mol, free, locked, iterations)
}
