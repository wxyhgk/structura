import assert from "node:assert/strict"
import test from "node:test"
import { toDocument } from "../../../src/chem/document.ts"
import { emptyDrawing } from "../../../src/chem/drawing.ts"
import { applyOps } from "../../../src/chem/ops.ts"
import { initialContent, initialMolecules, readMolText } from "../../../src/editor/imports/read.ts"

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

test("an embedded editor starts from a document if it can, else from molfile text", () => {
  const built = applyOps(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "label", atom: 1, text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }] },
  ])
  assert.ok(built.ok)
  const fromDocument = initialContent(toDocument(built.drawing), ETHANOL)
  assert.ok(!Array.isArray(fromDocument) && fromDocument.variables?.R1, "the document, with its variables, wins")
  const fromMolfile = initialContent("{ not a document", ETHANOL)
  assert.ok(Array.isArray(fromMolfile) && fromMolfile.length === 1, "an unreadable document falls back to the molfile")
  assert.deepEqual(initialContent(undefined, undefined), [])
})
