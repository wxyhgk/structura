import type { Molecule } from "../types.ts"
import { atomById, cloneMolecule, neighbors } from "./graph.ts"
import { objective, positionsFor } from "./relax/energy.ts"
import { minimize } from "./relax/minimize.ts"
import { setUp } from "./relax/setup.ts"
import { buildSprings } from "./relax/springs.ts"

export type RelaxOptions = {
  /** The atoms allowed to move. Every other atom stays exactly where it is. */
  atoms: Iterable<number>
  /** Atoms that stay put even when listed in `atoms`. */
  locked?: Iterable<number>
  /** Cap on minimiser steps. */
  iterations?: number
}

/**
 * How a wedge's start atom sees its neighbours: their order going round it, or for two
 * neighbours which side one is of the other. If this changes, the wedge means the other
 * stereoisomer.
 */
function handedness(mol: Molecule, centre: number): string {
  const atom = atomById(mol, centre)
  const around = neighbors(mol, centre)
  if (!atom || around.length < 2) return ""
  if (around.length === 2) {
    const [a, b] = around
    return Math.sign((a.x - atom.x) * (b.y - atom.y) - (a.y - atom.y) * (b.x - atom.x)).toString()
  }
  const order = [...around].sort((a, b) => Math.atan2(a.y - atom.y, a.x - atom.x) - Math.atan2(b.y - atom.y, b.x - atom.x)).map((item) => item.id)
  const start = order.indexOf(Math.min(...order))
  return [...order.slice(start), ...order.slice(0, start)].join(",")
}

function stereoCentres(mol: Molecule): number[] {
  return [...new Set(mol.bonds.filter((bond) => bond.stereo === "up" || bond.stereo === "down").map((bond) => bond.a))]
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
 * Nothing else moves, groups move whole, and no wedge or hash comes to mean the other
 * stereoisomer: a centre that would flip is held still, with its neighbours, and the
 * clean-up is run again.
 */
export function relax(mol: Molecule, options: RelaxOptions): Molecule {
  const free = new Set([...options.atoms].filter((id) => atomById(mol, id)))
  const locked = new Set(options.locked ?? [])
  const iterations = options.iterations ?? 300
  const centres = stereoCentres(mol)
  const before = new Map(centres.map((id) => [id, handedness(mol, id)]))

  for (let round = 0; round < 3; round++) {
    const next = relaxOnce(mol, free, locked, iterations)
    const flipped = centres.filter((id) => handedness(next, id) !== before.get(id))
    if (flipped.length === 0) return next
    for (const id of flipped) {
      locked.add(id)
      for (const other of neighbors(mol, id)) locked.add(other.id)
    }
  }
  for (const id of centres) {
    locked.add(id)
    for (const other of neighbors(mol, id)) locked.add(other.id)
  }
  return relaxOnce(mol, free, locked, iterations)
}
