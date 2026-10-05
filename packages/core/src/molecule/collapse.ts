import type { Molecule } from "../types.ts"

// Collapsed groups (Ph, Boc, tBu…): their atoms stay real atoms of the molecule, so the
// chemistry is always exact, but they are shown as one label on the anchor (atoms[0]).

/** The atoms hidden behind collapsed labels: every member of a collapsed group but its anchor. */
export function hiddenAtoms(mol: Molecule): Set<number> {
  const hidden = new Set<number>()
  for (const group of mol.groups) if (group.collapsed) for (const id of group.atoms.slice(1)) hidden.add(id)
  return hidden
}

/**
 * `ids` and, for each collapsed group whose anchor is among them, the atoms behind its label:
 * moving, rotating, deleting or copying a label takes the whole group along.
 */
export function withGroupMembers(mol: Molecule, ids: Iterable<number>): number[] {
  const all = new Set(ids)
  for (const group of mol.groups) if (group.collapsed && all.has(group.atoms[0])) for (const id of group.atoms) all.add(id)
  return [...all]
}

/**
 * The molecule as it is shown: each collapsed group reduced to its anchor carrying the label,
 * the atoms behind it and their bonds left out. Ids are unchanged, so what is picked on it
 * names the same atoms in the real molecule. For drawing and pointing only, never chemistry.
 */
export function displayMolecule(mol: Molecule): Molecule {
  if (!mol.groups.some((group) => group.collapsed)) return mol
  const hidden = hiddenAtoms(mol)
  const labels = new Map(mol.groups.filter((group) => group.collapsed).map((group) => [group.atoms[0], group.label]))
  return {
    ...mol,
    atoms: mol.atoms.flatMap((atom) => (hidden.has(atom.id) ? [] : [labels.has(atom.id) ? { ...atom, alias: labels.get(atom.id) } : atom])),
    bonds: mol.bonds.filter((bond) => !hidden.has(bond.a) && !hidden.has(bond.b)),
    groups: mol.groups.filter((group) => !group.collapsed),
  }
}

/** The groups with any atom among `ids`, or every group when `ids` is null. */
export function groupsTouching(mol: Molecule, ids: Iterable<number> | null): number[] {
  if (ids == null) return mol.groups.map((group) => group.id)
  const picked = new Set(ids)
  return mol.groups.filter((group) => group.atoms.some((id) => picked.has(id))).map((group) => group.id)
}

/** The molecule with the given groups collapsed into labels, or drawn out again. */
export function setCollapsed(mol: Molecule, groupIds: Iterable<number>, collapsed: boolean): Molecule {
  const chosen = new Set(groupIds)
  if (!mol.groups.some((group) => chosen.has(group.id) && group.collapsed !== collapsed)) return mol
  return { ...mol, groups: mol.groups.map((group) => (chosen.has(group.id) ? { ...group, collapsed } : group)) }
}
