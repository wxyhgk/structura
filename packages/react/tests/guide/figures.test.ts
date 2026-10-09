import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "@structura/core/formula"
import { figureSvg } from "../../src/guide/figures/build.ts"
import * as drawing from "../../src/guide/figures/drawing.ts"
import * as markush from "../../src/guide/figures/markush.ts"
import * as brackets from "../../src/guide/figures/brackets.ts"
import { hotkeyOps } from "@structura/engine"
import type { PressKey } from "../../src/guide/types.ts"

const figures = { ...drawing, ...markush, figureSvg }
const pressKey: PressKey = (mol, atom, key) => hotkeyOps(mol, { type: "atom", id: atom }, key)

test("every guide figure is built by the real ops, and shows what it says", () => {
  assert.deepEqual(figures.hoverSteps(pressKey).map((drawing) => drawing.molecule.atoms.length), [2, 3, 8])
  assert.equal(figures.bondKinds().molecule.bonds.length, 6)
  assert.deepEqual(figures.ringWays().map((drawing) => plainFormula(drawing.molecule)), ["C12H16", "C10H8", "C10H18"])
  assert.equal(plainFormula(figures.labelled().molecule), "C8H11NO2")
  assert.deepEqual(figures.formula().molecule.atoms.filter((atom) => atom.alias).map((atom) => atom.alias), ["X", "L", "Ar1", "R1"])
  const { drawing, products } = figures.attachment()
  assert.equal(drawing.attachments?.length, 1)
  assert.match(figures.figureSvg(drawing), /<line /)
  assert.equal(products.length, 3)
  // Over a fused system: a closed ellipse for (R1)n, an open curve for L2.
  const curved = figures.curvedAttachments()
  assert.match(figures.figureSvg(curved.loop), /<path d="M [^"]+ Z"/)
  assert.match(figures.figureSvg(curved.arc), /<path d="M [^"Z]+"/)
  assert.ok(!/<line [^>]*stroke-linecap="round"/.test(figures.figureSvg(curved.arc)), "no straight line drawn over the curve")
  const { carbazolyl, naphthylene, nR5 } = figures.pieces()
  for (const [piece, stars] of [[carbazolyl, 1], [naphthylene, 2], [nR5, 2]] as const) assert.equal(piece.molecule.atoms.filter((atom) => atom.alias === "*").length, stars)
  assert.equal(figures.expanded().length, 4)
})

test("the brackets page's figures carry their brackets into the picture", () => {
  assert.deepEqual(brackets.groupBracket().brackets?.map((bracket) => bracket.kind), ["group"])
  assert.equal(brackets.repeatBracket().brackets?.[0].repeat?.name, "n")
  assert.equal(brackets.longerRepeat().brackets?.[0].repeat?.name, "m")
  assert.deepEqual(brackets.labelledBracket().brackets?.[0].atoms, [7, 8])
  assert.match(figureSvg(brackets.repeatBracket()), /font-style="italic"[^>]*>n</)
})
