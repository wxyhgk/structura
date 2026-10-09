import assert from "node:assert/strict"
import test from "node:test"
import { sceneToSvg } from "../src/draw.ts"
import { addReactionArrow, emptyDrawing } from "../src/drawing.ts"
import { createBondAt } from "../src/molecule.ts"

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

test("svg export can widen its margin and draw an overlay on top", () => {
  const molecule = createBondAt(emptyDrawing().molecule, { x: 0, y: 0 }, { order: 1, stereo: "none" })
  const plain = sceneToSvg(molecule, false)
  const box = (svg: string) => svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)!.slice(1).map(Number)
  const wide = sceneToSvg(molecule, false, [], undefined, {}, { extraMargin: { left: 16, top: 16, right: 54, bottom: 16 }, overlay: "<g id=\"ids\"/>" })
  const [x, y, width, height] = box(plain)
  assert.deepEqual(box(wide), [x - 16, y - 16, width + 70, height + 32])
  assert.ok(wide.endsWith("<g id=\"ids\"/>\n</svg>\n"))
  assert.equal(sceneToSvg(molecule, false, [], undefined, {}, {}), plain)
})
