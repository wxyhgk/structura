import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { readMolfile } from "@structura/core/sdf"
import { geometryProblems } from "@structura/core/validate"
import { smilesToMolfile } from "../src/index.ts"

const rdkit = await initRDKitModule()

// SMILES pasted or handed to edit() is laid out by RDKit; a host that asks before saving a
// structure with problems must not be asked about RDKit's own pictures, crowded bridged and
// caged ones included (camphor's methyls, morphine, strychnine, cubane, taxol).
const SMILES = [
  "CC(=O)Oc1ccccc1C(=O)O",
  "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
  "CN1CC[C@]23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",
  "C1C2CC3CC1CC(C2)C3",
  "C12C3C4C1C5C2C3C45",
  "CC1(C)C2CCC1(C)C(=O)C2",
  "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
  "CC1(C)SC2C(NC(=O)Cc3ccccc3)C(=O)N2C1C(=O)O",
  "O=C7N2c1ccccc1[C@@]64[C@@H]2[C@@H]3[C@@H](OC/C=C5\\[C@@H]3C[C@@H]6N(CC4)C5)C7",
  "C1CCCCCCCCCCC1",
  "C1CCC2(CC1)CCCCC2",
  "c1ccc2cc3ccccc3cc2c1",
  "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
  "CCN(CC)C(=O)[C@H]1CN(C)[C@@H]2Cc3c[nH]c4cccc(C2=C1)c34",
  "CC(=O)OC1C(=O)C2(C)C(O)CC3OCC3(OC(C)=O)C2C(OC(=O)c2ccccc2)C2(O)CC(OC(=O)C(O)C(NC(=O)c3ccccc3)c3ccccc3)C(C)=C1C2(C)C",
  "C[C@]12CC[C@H]3[C@@H](CCc4cc(O)ccc34)[C@@H]1CC[C@@H]2O",
  "c1ccc(cc1)P(c1ccccc1)c1ccccc1",
  "CC(C)(C)c1cc(cc(c1O)C(C)(C)C)C",
  "[O-][N+](=O)c1ccc(cc1)[N+](=O)[O-]",
  "C1CC2CCC1CC2",
  "c1cc2ccc3cccc4ccc(c1)c2c34",
  "[Na+].[Cl-]",
]

test("RDKit's layouts are not reported as slips in the drawing", () => {
  for (const smiles of SMILES) {
    const laid = smilesToMolfile(rdkit, smiles)
    assert.ok("molfile" in laid, smiles)
    assert.deepEqual(geometryProblems(readMolfile(laid.molfile).mol), [], smiles)
  }
})
