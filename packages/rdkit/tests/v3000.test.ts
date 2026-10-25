import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { readMolfile } from "@structura/core/sdf"

const rdkit = await initRDKitModule()

/**
 * A read molfile with its coordinates apart, for comparing: V3000 carries more digits than
 * V2000, so they agree only to a few hundredths of a pixel.
 */
function read(text: string) {
  const result = readMolfile(text)
  const at = result.mol.atoms.map((atom) => [atom.x, atom.y])
  return { at, read: { ...result, mol: { ...result.mol, atoms: result.mol.atoms.map(({ x: _x, y: _y, ...atom }) => atom) } } }
}

function assertClose(actual: number[][], expected: number[][], message: string) {
  assert.equal(actual.length, expected.length, message)
  actual.forEach((point, index) => point.forEach((value, axis) => assert.ok(Math.abs(value - expected[index][axis]) < 0.05, message)))
}

test("RDKit's V3000 of a molecule reads as its V2000 does", () => {
  const smiles = [
    "[13CH3][C@H]([NH3+])C(=O)[O-]",
    "C[C@@H]1CC[C@H](O)CC1",
    "[*:1]c1ccc([*:2])cc1",
    "[2H]C([2H])([2H])c1cc[n+](C)cc1",
    "c1ccccc1[CH2]",
    "F/C=C/Cl",
    "[Fe+2].[Cl-].[Cl-]",
  ]
  for (const text of smiles) {
    const mol = rdkit.get_mol(text)
    assert.ok(mol, text)
    try {
      mol.set_new_coords(true)
      const v2000 = read(mol.get_molblock())
      const v3000 = read(mol.get_v3Kmolblock())
      assert.ok(mol.get_v3Kmolblock().includes("V3000"), text)
      assert.deepEqual(v3000.read, v2000.read, text)
      assertClose(v3000.at, v2000.at, text)
      assert.ok(v2000.read.problems.every((problem) => problem.severity !== "error"), text)
    } finally {
      mol.delete()
    }
  }
})
