import assert from "node:assert/strict"
import test from "node:test"
import { bracketMarks, buildScene, sceneToSvg, structureMarks } from "@structura/core/draw"
import { ringSystemPositions } from "@structura/core/markush"
import type { Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { build, run } from "@structura/testkit"

// Brackets and variable attachments drawn together: a bracket holds what belongs to its atoms.

/** Phenanthrene (atoms 1–14) with "(Rx)n" (15) on a loop round it, all in one group bracket. */
function bracketedLoop(extra: Op[] = []): Drawing {
  const base = build([
    { op: "add_scaffold", name: "phenanthrene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: -10, y: -10 } },
    { op: "label", atom: 15, text: "Rx" },
  ])
  const ring = ringSystemPositions(base.molecule, [1])!
  return run(base, [
    { op: "set_attachment", atom: 15, to: ring, shape: "loop", repeat: { min: 0, max: 3, name: "n" } },
    { op: "add_bracket", atoms: Array.from({ length: 15 }, (_, index) => index + 1) },
    ...extra,
  ])
}

const inside = (outer: { left: number; right: number; top: number; bottom: number }, inner: typeof outer) =>
  outer.left < inner.left && outer.right > inner.right && outer.top < inner.top && outer.bottom > inner.bottom

test("a group bracket round a loop's atoms stands clear of the ellipse and of the (Rx)n inside", () => {
  const drawing = bracketedLoop()
  const mol = drawing.molecule
  const labels = buildScene(mol, false).labels
  const marks = structureMarks(mol, drawing.attachments, drawing.brackets, labels)
  const [loop] = marks.attachments
  const [bracket] = marks.brackets
  assert.ok(loop.curve, "a loop has an ellipse")
  assert.ok(inside(bracket.box, loop.curve), "the ellipse is inside the bracket")
  assert.ok(inside(bracket.box, loop.bounds), "so is the line from Rx")
  // Without the attachments the bracket is only as wide as the atoms: the ellipse would stick out.
  const [bare] = bracketMarks(mol, drawing.brackets, labels)
  assert.ok(!inside(bare.box, loop.curve))
  // Hit-testing and export work it out the same way (labels left out, worked out alike).
  assert.deepEqual(structureMarks(mol, drawing.attachments, drawing.brackets).brackets[0].figures, bracket.figures)
  const svg = sceneToSvg(mol, false, [], drawing.attachments, {}, { brackets: drawing.brackets })
  const points = bracket.figures[0].points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
  assert.ok(svg.includes(`points="${points}"`))
})

test("an ellipse round the bracketed atoms counts even when its atom is outside; that atom's line does not", () => {
  // Rx moved out to the left, out of the bracket: only the ellipse widens the bracket.
  const drawing = bracketedLoop([{ op: "move", atoms: [15], dx: -200, dy: 0 }])
  const out = run(drawing, [{ op: "add_bracket", atoms: Array.from({ length: 14 }, (_, index) => index + 1) }, { op: "remove_bracket", id: 1 }])
  const marks = structureMarks(out.molecule, out.attachments, out.brackets)
  const [loop] = marks.attachments
  const [bracket] = marks.brackets
  assert.ok(inside(bracket.box, loop.curve!))
  assert.ok(bracket.box.left > loop.from.x, "the line from the outside Rx is not taken in")
})

test("an ellipse round only some of the bracketed atoms' neighbours is left alone", () => {
  // A bracket round one ring: the loop round all three rings is not its business.
  const drawing = bracketedLoop([{ op: "remove_bracket", id: 1 }, { op: "add_bracket", atoms: [1, 2, 3, 4, 5, 6] }])
  const marks = structureMarks(drawing.molecule, drawing.attachments, drawing.brackets)
  const [bare] = bracketMarks(drawing.molecule, drawing.brackets)
  assert.deepEqual(marks.brackets[0].figures, bare.figures)
})
