import type { MainModule } from "@rdkit/rdkit"

export type SmilesLine = { smiles: string; name: string }

/**
 * One SMILES per line, optionally followed by a name, as in .smi files. A dot inside a
 * SMILES keeps its pieces together (a salt stays one entry).
 */
export function smilesLines(text: string): SmilesLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [smiles, ...rest] = line.split(/\s+/)
      return { smiles, name: rest.join(" ") }
    })
}

/** Loose check for pasted text: every line starts with something SMILES could be. */
export function looksLikeSmiles(text: string): boolean {
  if (/^\s*M {2}END/m.test(text)) return false
  const lines = smilesLines(text)
  return lines.length > 0 && lines.every(({ smiles }) => /^[A-Za-z0-9@+\-[\]()=#$%./\\:*~]+$/.test(smiles) && /[A-Za-z]/.test(smiles))
}

/**
 * Turns a SMILES into a 2D molfile with RDKit: parse, lay out (CoordGen when the module
 * prefers it), kekulize and wedge. The editor then reads the molfile like any other.
 */
export function smilesToMolfile(rdkit: MainModule, smiles: string): { molfile: string } | { error: string } {
  const mol = rdkit.get_mol(smiles)
  if (!mol) return { error: `RDKit could not read "${smiles}"` }
  try {
    if (!mol.is_valid()) return { error: `RDKit could not read "${smiles}"` }
    mol.set_new_coords(true)
    return { molfile: mol.get_molblock() }
  } finally {
    mol.delete()
  }
}
