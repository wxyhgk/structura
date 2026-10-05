import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { applyOps } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { closestPair, label, run } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"
import { enumerate, linkerNames, siteKind } from "@structura/markush"

const { canonicalAll } = await chemistry()

/** Benzene (atoms 1–6) with R2 on atom 2, and –L–ETU off to the side, attached to any of atoms 1, 2, 3. */
function formula(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "place_atom", el: "C", at: { x: 200, y: 0 } },
    { op: "label", atom: 8, text: "L" },
    { op: "add_atom", el: "C", to: 8, as: "etu" },
    { op: "label", atom: "etu", text: "ETU" },
    { op: "set_attachment", atom: 8, to: [1, 2, 3] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("F")] },
    { op: "set_variable", name: "L", alternatives: [label("O")] },
    { op: "set_variable", name: "ETU", alternatives: [label("Ph")] },
  ])
}

test("a variable attachment is placed at each candidate in turn, displacing the R there", () => {
  const result = enumerate(formula())
  // On atom 1 or 3, R2 still chooses H or F; on atom 2, –L–ETU takes R2's place.
  assert.equal(result.total, 5)
  assert.deepEqual([result.molecules.length, result.failed], [5, 0])
  // Which molecules, not just which formulas: F sits next to the ether on atoms 1 and 3 (both
  // ortho to atom 2), so a misplaced attachment (meta or para) would show up here.
  const diphenylEther = "c1ccc(Oc2ccccc2)cc1"
  const orthoFluoro = "Fc1ccccc1Oc1ccccc1"
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll([diphenylEther, diphenylEther, diphenylEther, orthoFluoro, orthoFluoro]))
  for (const mol of result.molecules) assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
})

test("a linker such as L becomes a single bond or a divalent ring between its two neighbours", () => {
  const drawing = run(formula(), [
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bond" }, { kind: "class", class: "arylene", min: 6, max: 30 }, { kind: "class", class: "heteroarylene" }] },
  ])
  const result = enumerate(drawing, { representatives: true })
  assert.deepEqual(
    result.represented.L?.map((choice) => (choice.kind === "bridge" ? choice.name : "")),
    ["p-phenylene", "m-phenylene", "4,4'-biphenylene", "2,5-pyridinediyl"],
  )
  assert.equal(result.total, 15, "3 positions × (bond + 4 bridges)")
  assert.deepEqual([result.molecules.length, result.failed], [15, 0], JSON.stringify(result.failures))
  const formulas = new Set(result.molecules.map((mol) => plainFormula(mol)))
  assert.deepEqual([...formulas].sort(), ["C12H10", "C17H13N", "C18H14", "C24H18"], "biphenyl, pyridine, terphenyl, quaterphenyl")
  for (const mol of result.molecules) {
    assert.ok(mol.atoms.every((atom) => !atom.alias))
    assert.ok(closestPair(mol) > 0.6 * 40, `closest pair ${closestPair(mol).toFixed(1)}`)
  }
})

test("a linker can be given a divalent ring directly", () => {
  const drawing = run(formula(), [
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bridge", name: "p-phenylene" }] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual([result.molecules.length, result.failed], [3, 0])
  assert.ok(result.molecules.every((mol) => plainFormula(mol) === "C18H14"), "terphenyl at each position")
  assert.ok(!applyOps(drawing, [{ op: "set_variable", name: "L", alternatives: [{ kind: "bridge", name: "o-phenylene" as "p-phenylene" }] }]).ok)
})

test("one rule says how a placeholder sits, for the panel and for enumeration alike", () => {
  const drawing = formula()
  // L (atom 8) has one bond so far, plus the one its attachment will make.
  assert.equal(siteKind(drawing, 8), "link")
  assert.equal(siteKind(drawing, 9), "end", "ETU ends the branch")
  assert.equal(siteKind(drawing, 1), "ring")
  assert.deepEqual([...linkerNames(drawing)], ["L"])
  const loose = run(drawing, [{ op: "remove_attachment", atom: 8 }])
  assert.equal(siteKind(loose, 8), "end")
  assert.deepEqual([...linkerNames(loose)], [])
})
