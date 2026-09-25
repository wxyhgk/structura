import type { Bond, Molecule } from "../types.ts"
import { atomById, bondOrderSum, cloneMolecule } from "./graph.ts"

/**
 * Assigns single and double bonds in an aromatic system.
 *
 * Same idea as OpenBabel's kekulizer and RDKit's Kekulize: every aromatic
 * carbon that still has room for one more bond order must be incident to
 * exactly one double bond. That is a perfect matching, found by backtracking
 * and trying the most constrained atom first.
 */
export function kekulizeAromatic(mol: Molecule): Molecule {
  if (!mol.bonds.some((bond) => bond.aromatic)) return mol
  const next = cloneMolecule(mol)
  for (const bond of next.bonds) {
    if (!bond.aromatic) continue
    bond.order = 1
    bond.stereo = "none"
  }
  for (const bonds of aromaticComponents(next)) {
    const doubles = matchDoubles(next, bonds)
    const chosen = new Set(doubles.map(([a, b]) => pairKey(a, b)))
    for (const bond of bonds) {
      bond.order = chosen.has(pairKey(bond.a, bond.b)) ? 2 : 1
    }
  }
  return next
}

function aromaticComponents(mol: Molecule): Bond[][] {
  const bonds = mol.bonds.filter((bond) => bond.aromatic)
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    const current = parent.get(id) ?? id
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const bond of bonds) unite(bond.a, bond.b)
  const groups = new Map<number, Bond[]>()
  for (const bond of bonds) {
    const root = find(bond.a)
    const group = groups.get(root)
    if (group) group.push(bond)
    else groups.set(root, [bond])
  }
  return [...groups.values()]
}

function needsDouble(mol: Molecule, atomId: number): boolean {
  const atom = atomById(mol, atomId)
  if (!atom || atom.el !== "C") return false
  const target = 4 - Math.abs(atom.charge)
  return bondOrderSum(mol, atomId) < target
}

function matchDoubles(mol: Molecule, bonds: Bond[]): Array<[number, number]> {
  const degree = new Map<number, number>()
  for (const bond of bonds) {
    degree.set(bond.a, (degree.get(bond.a) ?? 0) + 1)
    degree.set(bond.b, (degree.get(bond.b) ?? 0) + 1)
  }
  const needy = new Set<number>()
  for (const id of degree.keys()) {
    if (needsDouble(mol, id)) needy.add(id)
  }
  const adj = new Map<number, number[]>()
  for (const id of needy) adj.set(id, [])
  for (const bond of bonds) {
    if (!needy.has(bond.a) || !needy.has(bond.b)) continue
    adj.get(bond.a)?.push(bond.b)
    adj.get(bond.b)?.push(bond.a)
  }
  for (const [id, neighbors] of adj) {
    neighbors.sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a - b)
    adj.set(id, neighbors)
  }

  const used = new Set<number>()
  const chosen: Array<[number, number]> = []

  function freeNeighbors(id: number): number[] {
    return (adj.get(id) ?? []).filter((neighbor) => !used.has(neighbor))
  }

  function search(pending: number[]): boolean {
    let atom = -1
    let choices: number[] = []
    for (const id of pending) {
      if (used.has(id)) continue
      const next = freeNeighbors(id)
      if (atom === -1 || next.length < choices.length) {
        atom = id
        choices = next
      }
    }
    if (atom === -1) return true
    if (choices.length === 0) return false
    for (const neighbor of choices) {
      used.add(atom)
      used.add(neighbor)
      chosen.push([atom, neighbor])
      if (search(pending)) return true
      chosen.pop()
      used.delete(atom)
      used.delete(neighbor)
    }
    return false
  }

  const everyone = [...needy]
  if (everyone.length % 2 === 0 && search(everyone)) return chosen
  chosen.length = 0
  used.clear()
  // Phenalene has an odd number of aromatic carbons. One outer carbon stays
  // CH2 and the other twelve take one double bond each.
  const optional = everyone.filter((id) => (degree.get(id) ?? 0) <= 2)
  for (const skip of optional) {
    if (search(everyone.filter((id) => id !== skip))) return chosen
    chosen.length = 0
    used.clear()
  }
  return []
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
