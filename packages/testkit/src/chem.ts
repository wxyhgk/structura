import initRDKitModule from "@rdkit/rdkit"
import { toMolfile } from "@structura/core/molfile"
import type { Drawing, Molecule } from "@structura/core/types"

// Chemistry as an outside referee: RDKit's canonical SMILES says whether two structures are
// the same molecule, whatever their coordinates, atom order or ids. Loads RDKit (about 0.4 s).

type RDKit = Awaited<ReturnType<typeof initRDKitModule>>
let loading: Promise<RDKit> | null = null

/** RDKit, loaded once for the whole test run. */
function rdkit(): Promise<RDKit> {
  return (loading ??= initRDKitModule())
}

export type Chemistry = {
  /** Canonical SMILES of a molecule, a drawing, or SMILES text. Throws if RDKit cannot read it. */
  canonical(input: Molecule | Drawing | string): string
  /** The canonical SMILES of each, sorted: a molecule set to compare as a whole (repeats kept). */
  canonicalAll(inputs: Array<Molecule | Drawing | string>): string[]
}

/** The referee, ready to use: `const { canonical } = await chemistry()` at the top of a test file. */
export async function chemistry(): Promise<Chemistry> {
  const module = await rdkit()
  const canonical = (input: Molecule | Drawing | string): string => {
    const text = typeof input === "string" ? input : toMolfile("molecule" in input ? input.molecule : input)
    const mol = module.get_mol(text)
    if (!mol) throw new Error(`RDKit cannot read ${typeof input === "string" ? input : "this molecule"}`)
    try {
      return mol.get_smiles()
    } finally {
      mol.delete()
    }
  }
  return { canonical, canonicalAll: (inputs) => inputs.map(canonical).sort() }
}
