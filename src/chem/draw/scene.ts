import { elementColor } from "../elements/index.ts"
import { dist } from "../geometry.ts"
import { atomById, neighbors } from "../molecule.ts"
import type { Atom, Molecule } from "../types.ts"
import { bondFigures, chainDoubleFlank, type DoubleFlank } from "./bonds/index.ts"
import { labelFor, type AtomLabel } from "./labels.ts"
import type { Figure } from "./primitives.ts"
import { inwardPoint } from "./rings.ts"

export type Scene = {
  figures: Figure[]
  labels: AtomLabel[]
}

/**
 * A double bond with an end atom (C=O, S=O, =CH2) is drawn as two centred lines; one
 * between two substituted atoms keeps a line on the backbone and puts the other inside.
 */
function doubleFlank(mol: Molecule, a: Atom, b: Atom): DoubleFlank {
  if (neighbors(mol, a.id).length === 1 || neighbors(mol, b.id).length === 1) return { side: 0, trimA: 0, trimB: 0 }
  return chainDoubleFlank(mol, a, b)
}

export function buildScene(mol: Molecule, colorHetero: boolean): Scene {
  const labels = mol.atoms
    .map((atom) => labelFor(mol, atom, colorHetero))
    .filter((label): label is AtomLabel => label != null)
  const boxes = new Map(labels.map((label) => [label.atomId, label.box]))
  const figures: Figure[] = []
  for (const bond of mol.bonds) {
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (!a || !b) continue
    if (dist(a, b) < 1) continue
    const toward = inwardPoint(mol, bond)
    figures.push(
      ...bondFigures(
        a,
        b,
        { order: bond.order, stereo: bond.stereo, look: bond.look, emphasis: bond.emphasis },
        elementColor(a.el, colorHetero),
        elementColor(b.el, colorHetero),
        toward,
        boxes.get(a.id) ?? null,
        boxes.get(b.id) ?? null,
        bond.order === 2 && !toward ? doubleFlank(mol, a, b) : null,
      ),
    )
  }
  return { figures, labels }
}
