import assert from "node:assert/strict"
import test from "node:test"
import { attachmentShape, bracketMarks, buildScene, sceneToSvg, structureMarks } from "@structura/core/draw"
import { followBrackets } from "@structura/core/drawing"
import { bondLengthAt } from "@structura/core/molecule"
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

/** Naphthalene (atoms 1–10) in a group bracket, and L1 (11) out to the right, level with its middle. */
function naphthaleneAndL1(extra: Op[] = []): Drawing {
  const base = build([{ op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } }])
  const ys = base.molecule.atoms.map((atom) => atom.y)
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2
  return run(base, [
    { op: "add_bracket", atoms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { op: "place_atom", el: "C", at: { x: 200, y: middle } },
    { op: "label", atom: 11, text: "L1" },
    ...extra,
  ])
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

test("an attachment whose candidates are a group bracket's atoms, from outside, is a bond into the bracket", () => {
  const drawing = naphthaleneAndL1([{ op: "set_attachment", atom: 11, to: ALL }])
  const mol = drawing.molecule
  const [attachment] = drawing.attachments!
  assert.equal(attachmentShape(mol, attachment, drawing.brackets), "bracket", "chosen by itself")
  assert.equal(attachmentShape(mol, attachment), "loop", "without the brackets it is a loop as before")
  const {
    attachments: [mark],
    brackets: [bracket],
  } = structureMarks(mol, drawing.attachments, drawing.brackets)
  assert.equal(mark.shape, "bracket")
  const L1 = mol.atoms.find((atom) => atom.id === 11)!
  const length = bondLengthAt(mol, 1)
  assert.ok(mark.from.x < L1.x && mark.from.x > bracket.uprights.right, "it leaves L1's label")
  assert.ok(Math.abs(mark.to.x - (bracket.uprights.right - 0.4 * length)) < 1e-6, "it ends 0.4 bond length past \"]\"")
  assert.ok(Math.abs(mark.to.y - L1.y) < 1e-6, "level, as L1 is level with the bracket")
  assert.equal(mark.curve, null)
  // "]", where the bond comes in, stands further off than "[", so the bond ends in the clear.
  const xs = mol.atoms.filter((atom) => atom.id <= 10).map((atom) => atom.x)
  assert.ok(bracket.uprights.right - Math.max(...xs) > Math.min(...xs) - bracket.uprights.left + 0.2 * length)
  assert.ok(
    mol.atoms.every((atom) => Math.hypot(atom.x - mark.to.x, atom.y - mark.to.y) > 0.3 * length),
    "and on no atom",
  )
  // The export draws the same straight line.
  const svg = sceneToSvg(mol, false, [], drawing.attachments, {}, { brackets: drawing.brackets })
  assert.ok(svg.includes(`x2="${mark.to.x.toFixed(2)}" y2="${mark.to.y.toFixed(2)}"`))
})

test("from above or off to a corner the bond still crosses into the bracket, clear of the serifs", () => {
  const corner = naphthaleneAndL1([
    { op: "move", atoms: [11], dx: 0, dy: -150 },
    { op: "set_attachment", atom: 11, to: ALL },
  ])
  const {
    attachments: [mark],
    brackets: [bracket],
  } = structureMarks(corner.molecule, corner.attachments, corner.brackets)
  const { right, top, bottom } = bracket.uprights
  assert.ok(mark.to.x < right && mark.to.y > top && mark.to.y < bottom, "it ends inside")
  // Where it crosses "]", it is below the top serif.
  const t = (right - mark.from.x) / (mark.to.x - mark.from.x)
  assert.ok(mark.from.y + (mark.to.y - mark.from.y) * t > top + 5)
})

test("the shape can be asked for, and only holds while the bracket does; candidates follow the bracket", () => {
  const drawing = naphthaleneAndL1([{ op: "set_attachment", atom: 11, to: ALL, shape: "arc" }])
  assert.equal(attachmentShape(drawing.molecule, drawing.attachments![0], drawing.brackets), "arc", "a shape asked for wins")
  const asked = run(drawing, [{ op: "set_attachment_shape", atom: 11, shape: "bracket" }])
  assert.equal(asked.attachments![0].shape, "bracket")
  const unbracketed = run(asked, [{ op: "remove_bracket", id: 1 }])
  assert.equal(attachmentShape(unbracketed.molecule, unbracketed.attachments![0], unbracketed.brackets), "loop", "no bracket: chosen as if not asked")
  // Deleting a bracketed atom: the bracket and the candidates lose it together.
  const smaller = run(asked, [{ op: "remove", atoms: [1] }])
  assert.deepEqual(smaller.attachments![0].to, smaller.brackets![0].atoms)
  assert.equal(attachmentShape(smaller.molecule, smaller.attachments![0], smaller.brackets), "bracket")
})

test("followBrackets: when a bracket's atoms change, attachments drawn into it take the new atoms", () => {
  const before = naphthaleneAndL1([{ op: "set_attachment", atom: 11, to: ALL, repeat: { min: 1, max: 10, name: "m" } }])
  const changed = { ...before, brackets: [{ ...before.brackets![0], atoms: [1, 2, 3, 4, 5, 6] }] }
  const after = followBrackets(before, changed)
  assert.deepEqual(after.attachments![0].to, [1, 2, 3, 4, 5, 6])
  assert.equal(after.attachments![0].repeat?.max, 6, "the count shrinks with the positions")
  // An attachment that did not go into the bracket is left alone.
  const elsewhere = naphthaleneAndL1([{ op: "set_attachment", atom: 11, to: [1, 2, 3] }])
  assert.equal(followBrackets(elsewhere, { ...elsewhere, brackets: changed.brackets }).attachments, elsewhere.attachments)
})
