import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "@structura/core/formula"
import * as figures from "../../../src/editor/shell/guide/figures.ts"

test("every guide figure is built by the real ops, and shows what it says", () => {
  assert.deepEqual(figures.hoverSteps().map((drawing) => drawing.molecule.atoms.length), [2, 3, 8])
  assert.equal(figures.bondKinds().molecule.bonds.length, 6)
  assert.deepEqual(figures.ringWays().map((drawing) => plainFormula(drawing.molecule)), ["C12H16", "C10H8", "C10H18"])
  assert.equal(plainFormula(figures.labelled().molecule), "C8H11NO2")
  assert.deepEqual(figures.formula().molecule.atoms.filter((atom) => atom.alias).map((atom) => atom.alias), ["X", "L", "Ar1", "R1"])
  const { drawing, products } = figures.attachment()
  assert.equal(drawing.attachments?.length, 1)
  assert.match(figures.figureSvg(drawing), /<line /)
  assert.equal(products.length, 3)
  const { carbazolyl, naphthylene, nR5 } = figures.pieces()
  for (const [piece, stars] of [[carbazolyl, 1], [naphthylene, 2], [nR5, 2]] as const) assert.equal(piece.molecule.atoms.filter((atom) => atom.alias === "*").length, stars)
  assert.equal(figures.expanded().length, 4)
})
