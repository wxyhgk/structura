import type { Bond, Molecule } from "../types.ts"
import { atomById, bondOrderSum, cloneMolecule } from "./graph.ts"

/**
 * Assigns single and double bonds in an aromatic system.
 *
 * Same idea as OpenBabel's kekulizer and RDKit's Kekulize: every aromatic
 * carbon that still has room for one more bond order must be incident to
 * exactly one double bond. That is a perfect matching, found by backtracking
 * and trying the most constrained atom first. Charges decide who must take one:
 * N+ and O+ must (pyridinium, pyrylium), C+ and C- must not (tropylium,
 * cyclopentadienide). A neutral two-bonded N, P or As may take a double bond but
 * does not have to: pyridine's N does, pyrrole's stays single and keeps its H.
 */
export function kekulizeAromatic(mol: Molecule): Molecule {
  return kekulizeAromaticReport(mol).mol
}

/**
 * Like kekulizeAromatic, and also says how many aromatic pieces could not be given a
 * clean alternation. With `near`, only the aromatic pieces touching those atoms are
 * redone, so adding one ring leaves the rest of the drawing as it was.
 */
export function kekulizeAromaticReport(mol: Molecule, near?: Set<number>): { mol: Molecule; unresolved: number } {
  if (!mol.bonds.some((bond) => bond.aromatic)) return { mol, unresolved: 0 }
  const next = cloneMolecule(mol)
  let unresolved = 0
  for (const bonds of aromaticComponents(next)) {
    if (near && !bonds.some((bond) => near.has(bond.a) || near.has(bond.b))) continue
    for (const bond of bonds) {
      bond.order = 1
      bond.stereo = "none"
      bond.look = undefined
    }
    const { pairs, complete } = matchDoubles(next, bonds)
    if (!complete) unresolved++
    const chosen = new Set(pairs.map(([a, b]) => pairKey(a, b)))
    for (const bond of bonds) {
      bond.order = chosen.has(pairKey(bond.a, bond.b)) ? 2 : 1
    }
  }
  return { mol: next, unresolved }
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

/** Aromatic atoms that must end up with one double bond. */
function needsDouble(mol: Molecule, atomId: number): boolean {
  const atom = atomById(mol, atomId)
  if (!atom) return false
  const bonds = bondOrderSum(mol, atomId)
  if (atom.el === "C") return atom.charge === 0 && bonds < 4
  if (["N", "P", "As"].includes(atom.el)) return atom.charge === 1 && bonds < 4
  if (["O", "S", "Se"].includes(atom.el)) return atom.charge === 1 && bonds < 3
  return false
}

/** Ring N, P or As that can take a double bond without being forced to. */
function mayDouble(mol: Molecule, atomId: number): boolean {
  const atom = atomById(mol, atomId)
  if (!atom || atom.charge !== 0 || !["N", "P", "As"].includes(atom.el)) return false
  return bondOrderSum(mol, atomId) < 3
}

function matchDoubles(mol: Molecule, bonds: Bond[]): { pairs: Array<[number, number]>; complete: boolean } {
  const degree = new Map<number, number>()
  for (const bond of bonds) {
    degree.set(bond.a, (degree.get(bond.a) ?? 0) + 1)
    degree.set(bond.b, (degree.get(bond.b) ?? 0) + 1)
  }
  const needy = new Set<number>()
  const willing = new Set<number>()
  for (const id of degree.keys()) {
    if (needsDouble(mol, id)) needy.add(id)
    else if (mayDouble(mol, id)) willing.add(id)
  }
  const partner = (id: number) => needy.has(id) || willing.has(id)
  const adj = new Map<number, number[]>()
  for (const id of needy) adj.set(id, [])
  for (const bond of bonds) {
    if (!partner(bond.a) || !partner(bond.b) || (!needy.has(bond.a) && !needy.has(bond.b))) continue
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
  if ((willing.size > 0 || everyone.length % 2 === 0) && search(everyone)) return { pairs: chosen, complete: true }
  chosen.length = 0
  used.clear()
  // Phenalene has an odd number of aromatic carbons. One outer carbon stays
  // CH2 and the other twelve take one double bond each.
  const optional = everyone.filter((id) => (degree.get(id) ?? 0) <= 2)
  for (const skip of optional) {
    if (search(everyone.filter((id) => id !== skip))) return { pairs: chosen, complete: false }
    chosen.length = 0
    used.clear()
  }
  return { pairs: [], complete: everyone.length === 0 }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
