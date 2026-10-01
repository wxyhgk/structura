import type { Atom, Bond, BondLook, BondStyle, Group, Molecule, Selection } from "../types.ts"
import { bondsOf, lookup } from "./lookup.ts"

/** A look only survives on a plain single bond. */
function lookFor(style: BondStyle): BondLook | undefined {
  return style.order === 1 && style.stereo === "none" ? style.look : undefined
}

export function emptyMolecule(): Molecule {
  return { atoms: [], bonds: [], groups: [], nextAtomId: 1, nextBondId: 1, nextGroupId: 1 }
}

export function cloneMolecule(mol: Molecule): Molecule {
  return {
    atoms: mol.atoms.map((atom) => ({ ...atom })),
    bonds: mol.bonds.map((bond) => ({ ...bond })),
    groups: mol.groups.map((group) => ({ ...group, atoms: [...group.atoms] })),
    nextAtomId: mol.nextAtomId,
    nextBondId: mol.nextBondId,
    nextGroupId: mol.nextGroupId,
  }
}

export function groupOf(mol: Molecule, atomId: number): Group | undefined {
  return mol.groups.find((group) => group.atoms.includes(atomId))
}

/**
 * Editing a group's atoms or bonds turns it back into plain atoms: it is no longer the
 * group its label names. Moving, rotating and flipping keep it. Works on a fresh clone.
 */
function dissolveTouching(next: Molecule, atomIds: Iterable<number>): void {
  const touched = new Set(atomIds)
  if (touched.size === 0 || next.groups.length === 0) return
  next.groups = next.groups.filter((group) => !group.atoms.some((id) => touched.has(id)))
}

export function atomById(mol: Molecule, id: number): Atom | undefined {
  return lookup(mol).atomById.get(id)
}

export function bondById(mol: Molecule, id: number): Bond | undefined {
  return lookup(mol).bondById.get(id)
}

/** The bond joining two atoms, whichever way round it was drawn. */
export function bondBetween(mol: Molecule, a: number, b: number): Bond | undefined {
  return bondsOf(mol, a).find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))
}

export function neighbors(mol: Molecule, id: number): Atom[] {
  const found: Atom[] = []
  for (const bond of bondsOf(mol, id)) {
    const other = atomById(mol, bond.a === id ? bond.b : bond.a)
    if (other) found.push(other)
  }
  return found
}

export function bondOrderSum(mol: Molecule, id: number): number {
  let sum = 0
  for (const bond of bondsOf(mol, id)) sum += bond.order
  return sum
}

export function addAtom(
  mol: Molecule,
  el: string,
  x: number,
  y: number,
  charge = 0,
): { mol: Molecule; id: number } {
  const next = cloneMolecule(mol)
  const id = next.nextAtomId++
  next.atoms.push({ id, el, x, y, charge })
  return { mol: next, id }
}

export function addBond(
  mol: Molecule,
  a: number,
  b: number,
  style: BondStyle,
  overwrite = true,
): { mol: Molecule; id: number } | null {
  if (a === b) return null
  const existing = bondBetween(mol, a, b)
  if (existing) {
    if (!overwrite) return { mol, id: existing.id }
    const next = cloneMolecule(mol)
    const bond = next.bonds.find((item) => item.id === existing.id)
    if (!bond) return null
    dissolveTouching(next, [a, b])
    bond.order = style.order
    bond.stereo = style.order === 1 ? style.stereo : "none"
    bond.look = lookFor(style)
    // A wedge starts at `a`, so redrawing one follows the direction it was drawn in.
    if (bond.stereo !== "none") {
      bond.a = a
      bond.b = b
    }
    return { mol: next, id: existing.id }
  }
  const next = cloneMolecule(mol)
  dissolveTouching(next, [a, b])
  const id = next.nextBondId++
  next.bonds.push({
    id,
    a,
    b,
    order: style.order,
    stereo: style.order === 1 ? style.stereo : "none",
    ...(lookFor(style) ? { look: lookFor(style) } : {}),
  })
  return { mol: next, id }
}

export function setBondOrder(mol: Molecule, bondIds: number[], order: 1 | 2 | 3): Molecule {
  const wanted = new Set(bondIds)
  const next = cloneMolecule(mol)
  dissolveTouching(next, mol.bonds.filter((bond) => wanted.has(bond.id)).flatMap((bond) => [bond.a, bond.b]))
  for (const bond of next.bonds) {
    if (!wanted.has(bond.id)) continue
    bond.order = order
    if (order !== 1) {
      bond.stereo = "none"
      bond.look = undefined
    }
    if (order !== 2) bond.emphasis = undefined
  }
  return next
}

export function deleteSelection(mol: Molecule, selection: Selection): Molecule {
  const atoms = new Set(selection.atoms)
  const bonds = new Set(selection.bonds)
  const next = cloneMolecule(mol)
  const endpoints = mol.bonds.filter((bond) => bonds.has(bond.id)).flatMap((bond) => [bond.a, bond.b])
  dissolveTouching(next, [...atoms, ...endpoints])
  next.bonds = next.bonds.filter(
    (bond) => !bonds.has(bond.id) && !atoms.has(bond.a) && !atoms.has(bond.b),
  )
  next.atoms = next.atoms.filter((atom) => !atoms.has(atom.id))
  return next
}

export function setElement(mol: Molecule, ids: number[], el: string): Molecule {
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  dissolveTouching(next, wanted)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.el = el
    atom.alias = undefined
    atom.isotope = undefined
  }
  return next
}

export function setIsotope(mol: Molecule, ids: number[], isotope: number | undefined): Molecule {
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  dissolveTouching(next, wanted)
  for (const atom of next.atoms) {
    if (wanted.has(atom.id)) atom.isotope = isotope
  }
  return next
}

export function setAlias(mol: Molecule, id: number, alias: string | undefined): Molecule {
  const next = cloneMolecule(mol)
  const atom = next.atoms.find((item) => item.id === id)
  if (!atom) return mol
  dissolveTouching(next, [id])
  atom.alias = alias
  return next
}

export function bumpCharge(mol: Molecule, ids: number[], delta: number): Molecule {
  const wanted = new Set(ids)
  const next = cloneMolecule(mol)
  if (delta !== 0) dissolveTouching(next, wanted)
  for (const atom of next.atoms) {
    if (!wanted.has(atom.id)) continue
    atom.charge = Math.max(-3, Math.min(3, atom.charge + delta))
  }
  return next
}

/**
 * The atoms given, the bonds between them and the groups wholly inside them, with their
 * ids unchanged: what copying a selection puts on the clipboard.
 */
export function subMolecule(mol: Molecule, atomIds: number[]): Molecule {
  const wanted = new Set(atomIds)
  return {
    atoms: mol.atoms.filter((atom) => wanted.has(atom.id)).map((atom) => ({ ...atom })),
    bonds: mol.bonds.filter((bond) => wanted.has(bond.a) && wanted.has(bond.b)).map((bond) => ({ ...bond })),
    groups: mol.groups
      .filter((group) => group.atoms.every((id) => wanted.has(id)))
      .map((group) => ({ ...group, atoms: [...group.atoms] })),
    nextAtomId: mol.nextAtomId,
    nextBondId: mol.nextBondId,
    nextGroupId: mol.nextGroupId,
  }
}

export function setBondLook(mol: Molecule, bondId: number, style: BondStyle): Molecule {
  const next = cloneMolecule(mol)
  const bond = next.bonds.find((item) => item.id === bondId)
  if (!bond) return mol
  dissolveTouching(next, [bond.a, bond.b])
  bond.order = style.order
  bond.stereo = style.order === 1 ? style.stereo : "none"
  bond.look = lookFor(style)
  bond.emphasis = style.order === 2 ? style.emphasis : undefined
  bond.aromatic = undefined
  return next
}

export function componentOf(mol: Molecule, atomId: number): number[] {
  const seen = new Set<number>([atomId])
  const queue = [atomId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue
    for (const neighbor of neighbors(mol, current)) {
      if (seen.has(neighbor.id)) continue
      seen.add(neighbor.id)
      queue.push(neighbor.id)
    }
  }
  return [...seen]
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

/**
 * Copies `piece` into `target`, moved by (dx, dy), with fresh ids from target's counters,
 * so nothing already handed out is reused. Returns the copy's atom ids.
 */
export function spliceIn(target: Molecule, piece: Molecule, dx: number, dy: number): { mol: Molecule; ids: number[] } {
  const next = cloneMolecule(target)
  const ids = new Map<number, number>()
  for (const atom of piece.atoms) {
    const id = next.nextAtomId++
    ids.set(atom.id, id)
    next.atoms.push({ ...atom, id, x: atom.x + dx, y: atom.y + dy })
  }
  for (const bond of piece.bonds) {
    next.bonds.push({ ...bond, id: next.nextBondId++, a: ids.get(bond.a) ?? 0, b: ids.get(bond.b) ?? 0 })
  }
  for (const group of piece.groups) {
    next.groups.push({ ...group, id: next.nextGroupId++, atoms: group.atoms.map((id) => ids.get(id) ?? 0) })
  }
  return { mol: next, ids: [...ids.values()] }
}
