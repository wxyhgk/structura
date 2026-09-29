import assert from "node:assert/strict"
import test from "node:test"
import { initialMolecules, readMolText } from "../../../src/editor/imports/read.ts"

const ETHANOL = `ethanol
  test

  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.2500    1.2990    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
M  END
`

test("molfile text reads into molecules the editor can hold", () => {
  const { molecules, lines } = readMolText(ETHANOL)
  assert.equal(molecules.length, 1)
  assert.deepEqual(molecules[0].atoms.map((atom) => atom.el), ["C", "C", "O"])
  assert.deepEqual(lines, [])
})

test("the starting document is empty for missing, blank or unreadable text", () => {
  assert.deepEqual(initialMolecules(undefined), [])
  assert.deepEqual(initialMolecules("  \n"), [])
  assert.deepEqual(initialMolecules("not a molfile"), [])
  assert.equal(initialMolecules(ETHANOL).length, 1)
})
