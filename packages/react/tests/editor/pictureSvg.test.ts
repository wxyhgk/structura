import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { emptySelection } from "@structura/core/molecule"
import type { Drawing, Molecule } from "@structura/core/types"
import { pictureSvg } from "../../src/editor/pictureSvg.ts"

const atom = (id: number, el: string, x: number) => ({ id, el, x, y: 0, charge: 0 })
const molecule = {
  atoms: [atom(1, "C", 0), atom(2, "O", 30), atom(3, "N", 300)],
  bonds: [{ id: 1, a: 1, b: 2, order: 1, stereo: "none" }],
  groups: [],
  nextAtomId: 4,
  nextBondId: 2,
  nextGroupId: 1,
} as Molecule

const drawing = (mol: Molecule): Drawing => ({ ...emptyDrawing(), molecule: mol, arrows: [{ id: 1, x1: 0, y1: 60, x2: 90, y2: 60 }] } as Drawing)

test("copy as image pictures the whole drawing, arrows included, when nothing is selected", () => {
  const svg = pictureSvg(drawing(molecule), emptySelection(), false)
  assert.match(svg, />N</)
  assert.match(svg, /<polygon/, "the arrow head")
})

test("copy as image pictures only the selection when there is one", () => {
  const svg = pictureSvg(drawing(molecule), { atoms: [], bonds: [1] }, false)
  assert.match(svg, />O</)
  assert.doesNotMatch(svg, />N</)
})

test("copy as image has nothing to picture on an empty page", () => {
  assert.equal(pictureSvg(emptyDrawing(), emptySelection(), false), "")
})
