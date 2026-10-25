import type { MainModule } from "@rdkit/rdkit"
import { angleTo, dist, snapAngle } from "@structura/core/geometry"
import { boundsCenter, emptyMolecule, rotateAtoms } from "@structura/core/molecule"
import { readMolfile, type MolRecord } from "@structura/core/sdf"
import type { Molecule } from "@structura/core/types"
import { smilesLines, smilesToMolfile } from "./smiles.ts"

const STEP = Math.PI / 6

/**
 * The molecule turned so its longest axis (its two atoms furthest apart) lies across the
 * page, as smilesDrawer's rotateDrawing does: CoordGen leaves it at any angle, and a long
 * molecule standing upright comes out small in a column or a table cell. The turn is a
 * multiple of 30°, so bonds laid out on the 30° grid stay on it and the axis ends up within
 * 15° of level. Rigid, so wedges keep their meaning.
 */
export function levelled(mol: Molecule): Molecule {
  let far = { a: mol.atoms[0], b: mol.atoms[0], length: 0 }
  for (const [index, a] of mol.atoms.entries()) {
    for (const b of mol.atoms.slice(index + 1)) {
      const length = dist(a, b)
      if (length > far.length) far = { a, b, length }
    }
  }
  if (far.length === 0) return mol
  // An axis has no direction: fold its angle into (-90°, 90°].
  let angle = angleTo(far.a, far.b)
  if (angle > Math.PI / 2) angle -= Math.PI
  if (angle <= -Math.PI / 2) angle += Math.PI
  const turn = -snapAngle(angle, STEP)
  const ids = mol.atoms.map((atom) => atom.id)
  return turn === 0 ? mol : rotateAtoms(mol, ids, boundsCenter(mol, ids)!, turn)
}

/**
 * SMILES text (one per line, optionally named) as records, the way an SD file reads: each
 * keeps its name, or its SMILES when it has none, and lies level (see levelled). A SMILES
 * RDKit cannot read becomes an empty record carrying the error, so core's usableRecords
 * leaves it out and says why.
 */
export function smilesRecords(rdkit: MainModule, text: string): MolRecord[] {
  return smilesLines(text).map(({ smiles, name }) => {
    const result = smilesToMolfile(rdkit, smiles)
    if ("error" in result) {
      return { mol: emptyMolecule(), title: smiles, properties: {}, problems: [{ code: "bad-molfile", severity: "error", message: result.error }] }
    }
    const read = readMolfile(result.molfile)
    return { mol: levelled(read.mol), title: name || smiles, properties: {}, problems: read.problems }
  })
}
