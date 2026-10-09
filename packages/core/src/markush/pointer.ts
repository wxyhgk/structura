import { pointInPolygon } from "../geometry.ts"
import { atomById, deleteSelection } from "../molecule/graph.ts"
import { ringMembership } from "../molecule/cycles.ts"
import type { Drawing, Molecule, Point } from "../types.ts"

// Markush drawing: a line drawn into a ring's middle means "attached at any free position
// of that ring". A drawing convention of the pointer tools, used only when asked for.

/**
 * The ring whose inside the point is in (its atoms in order round it), with the atoms a
 * substituent could hang from: the ring's atoms that are in no other ring (not the fusion
 * atoms). Null when the point is in no ring, the ring contains `except` (the atom the line
 * starts from), or it leaves fewer than two such atoms.
 */
export function ringAt(mol: Molecule, point: Point, except?: number): { ring: number[]; positions: number[] } | null {
  const { rings, count } = ringMembership(mol)
  const ring = rings.find((ids) => pointInPolygon(point, ids.map((id) => atomById(mol, id)!)))
  if (!ring || (except != null && ring.includes(except))) return null
  const positions = ring.filter((id) => count.get(id) === 1)
  return positions.length >= 2 ? { ring, positions } : null
}

/** The free positions of the ring whose inside the point is in, as ringAt finds it; null for none. */
export function ringPositionsAt(mol: Molecule, point: Point, except?: number): number[] | null {
  return ringAt(mol, point, except)?.positions ?? null
}

/**
 * The free positions of the whole fused ring system the given ring positions belong to:
 * every ring sharing atoms with theirs, and so on outward (carbazole's three rings from
 * one of them), taking the atoms that sit in one ring only (the fusion atoms carry no
 * substituent). Null when the atoms are in no ring.
 */
export function ringSystemPositions(mol: Molecule, positions: readonly number[]): number[] | null {
  const { rings, count } = ringMembership(mol)
  const inSystem = new Set<number>(positions)
  const taken = new Set<number>()
  let grew = true
  while (grew) {
    grew = false
    for (const [index, ring] of rings.entries()) {
      if (taken.has(index) || !ring.some((id) => inSystem.has(id))) continue
      taken.add(index)
      for (const id of ring) inSystem.add(id)
      grew = true
    }
  }
  if (taken.size === 0) return null
  return mol.atoms.filter((atom) => inSystem.has(atom.id) && count.get(atom.id) === 1).map((atom) => atom.id)
}

/**
 * Whether atom `id`, were it at `at`, would be a line drawn into a ring's middle: a bare
 * carbon ending one bond, not in a ring itself, sitting inside a ring its neighbour is not
 * part of. Returns that ring's free positions, or null. A labelled or charged atom there is meant.
 */
export function ringPointerAt(mol: Molecule, id: number, at: Point): number[] | null {
  const tip = atomById(mol, id)
  if (!tip || tip.el !== "C" || tip.alias || tip.charge !== 0 || tip.isotope != null) return null
  const bonded = mol.bonds.filter((bond) => bond.a === id || bond.b === id)
  if (bonded.length !== 1 || ringMembership(mol).count.has(id) || mol.groups.some((group) => group.atoms.includes(id))) return null
  const hub = bonded[0].a === id ? bonded[0].b : bonded[0].a
  return ringPositionsAt(mol, at, hub)
}

/**
 * Markush drawing: a line drawn into a ring's middle, however it was drawn, means "attached
 * at any free position of that ring". Each such end atom among `ids` is taken away, and the
 * atom it hung off gets a variable attachment to the ring instead.
 */
export function absorbRingPointers(drawing: Drawing, ids: Iterable<number>): Drawing {
  let next = drawing
  for (const id of ids) {
    const mol = next.molecule
    const tip = atomById(mol, id)
    const positions = tip ? ringPointerAt(mol, id, tip) : null
    if (!positions) continue
    const bond = mol.bonds.find((item) => item.a === id || item.b === id)!
    const hub = bond.a === id ? bond.b : bond.a
    const others = (next.attachments ?? []).filter((attachment) => attachment.atom !== hub)
    next = { ...next, molecule: deleteSelection(mol, { atoms: [id], bonds: [] }), attachments: [...others, { atom: hub, to: positions }] }
  }
  return next
}
