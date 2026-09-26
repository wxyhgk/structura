import assert from "node:assert/strict"
import test from "node:test"
import { sceneToSvg } from "../../src/chem/draw.ts"
import { addReactionArrow, emptyDrawing } from "../../src/chem/drawing.ts"
import { createBondAt } from "../../src/chem/molecule.ts"

test("a reaction arrow goes on the drawing and leaves the molecule alone", () => {
  const molecule = createBondAt(emptyDrawing().molecule, { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const drawing = { ...emptyDrawing(), molecule }
  const ids = molecule.atoms.map((atom) => atom.id)

  const once = addReactionArrow(drawing, ids, "right")
  assert.equal(once.molecule, molecule)
  assert.equal(once.arrows.length, 1)
  assert.ok(once.arrows[0].x1 > Math.max(...molecule.atoms.map((atom) => atom.x)))
  assert.equal(drawing.arrows.length, 0)

  const twice = addReactionArrow(once, ids, "right")
  assert.equal(twice.arrows.length, 2)
  assert.notEqual(twice.arrows[0].id, twice.arrows[1].id)
  assert.ok(twice.arrows[1].x1 > twice.arrows[0].x1)
})

test("svg export keeps arrows inside the view box", () => {
  const molecule = createBondAt(emptyDrawing().molecule, { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const drawing = addReactionArrow({ ...emptyDrawing(), molecule }, molecule.atoms.map((atom) => atom.id), "right")
  const svg = sceneToSvg(drawing.molecule, false, drawing.arrows)
  const box = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)
  assert.ok(box)
  const [x, , width] = box.slice(1).map(Number)
  const arrow = drawing.arrows[0]
  assert.ok(x + width >= Math.max(arrow.x1, arrow.x2))
})
