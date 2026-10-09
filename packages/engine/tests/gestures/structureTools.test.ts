import assert from "node:assert/strict"
import test from "node:test"
import { ringMembership } from "@structura/core/molecule"
import type { Molecule, Point } from "@structura/core/types"
import { createEditor, toolLabel } from "@structura/engine"
import { build, run } from "@structura/testkit"
import { fakeCanvas } from "@structura/testkit/engine"

/** The middle of each ring of the molecule, in the order core finds them. */
function ringCentres(mol: Molecule): Point[] {
  return ringMembership(mol).rings.map((ids) => {
    const atoms = ids.map((id) => mol.atoms.find((atom) => atom.id === id)!)
    return { x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length, y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length }
  })
}

/** Naphthalene, and a lone carbon well below it, with a tool picked. */
function naphthalene(tool: "attach" | "bracket") {
  const start = build([{ op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } }])
  const bottom = Math.max(...start.molecule.atoms.map((atom) => atom.y))
  const editor = createEditor(run(start, [{ op: "place_atom", el: "C", at: { x: 0, y: bottom + 120 } }]))
  editor.setTool(tool)
  const mol = editor.latest().molecule
  return { editor, ring: start.molecule.atoms.map((atom) => atom.id), lone: mol.atoms.at(-1)!, centres: ringCentres(mol), ...fakeCanvas(editor) }
}

/** The ring atoms in no other ring: where a substituent can go. */
const freePositions = (mol: Molecule) => {
  const { count } = ringMembership(mol)
  return mol.atoms.filter((atom) => count.get(atom.id) === 1).map((atom) => atom.id)
}

test("the bracket tool: a box dragged round atoms brackets them as one step, of the kind picked; the preview shows the box and its atoms", () => {
  const editor = createEditor(build([{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }, { x: 105, y: -20 }] }]))
  editor.setTool("bracket")
  const { press, move, release, shown, drag } = fakeCanvas(editor)
  press({ x: 20, y: -40 })
  move({ x: 90, y: 20 })
  assert.equal(shown.preview?.kind, "bracket")
  assert.deepEqual(shown.preview?.kind === "bracket" && shown.preview.atoms, [2, 3])
  release({ x: 90, y: 20 })
  assert.equal(shown.preview, null)
  assert.deepEqual(editor.latest().brackets, [{ id: 1, atoms: [2, 3], kind: "group" }])
  editor.undo()
  assert.equal(editor.latest().brackets, undefined)
  // A repeat unit gets the usual count.
  editor.setBracketKind("repeat")
  drag({ x: 20, y: -40 }, { x: 90, y: 20 })
  assert.deepEqual(editor.latest().brackets, [{ id: 2, atoms: [2, 3], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } }])
  // A box round nothing makes nothing; the tool stays.
  drag({ x: 300, y: 300 }, { x: 340, y: 340 })
  assert.equal(editor.latest().brackets?.length, 1)
  assert.equal(editor.get().tool, "bracket")
})

test("the bracket tool on a bracket's stroke selects what it holds", () => {
  const editor = createEditor(build([{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }] }, { op: "add_bracket", atoms: [2, 3] }]))
  editor.setTool("bracket")
  const { click } = fakeCanvas(editor)
  const right = Math.max(...editor.latest().molecule.atoms.map((atom) => atom.x))
  // Somewhere along "]", right of the last atom: found by walking out until a press selects.
  for (let x = right; x < right + 30 && editor.get().selection.atoms.length === 0; x += 1) click({ x, y: -6 })
  assert.deepEqual(editor.get().selection.atoms, [2, 3])
  assert.equal(editor.latest().brackets?.length, 1, "no new bracket")
})

test("picking the bracket tool with atoms selected brackets them at once, keeps the selection and stays the tool", () => {
  const editor = createEditor(build([{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }] }]))
  editor.takeBracketTool()
  assert.equal(editor.get().tool, "bracket")
  assert.equal(editor.latest().brackets, undefined, "nothing selected, nothing bracketed")
  editor.setSelection({ atoms: [1, 2], bonds: [] })
  editor.takeBracketTool("repeat")
  assert.deepEqual(editor.latest().brackets, [{ id: 1, atoms: [1, 2], kind: "repeat", repeat: { min: 1, max: 4, name: "n" } }])
  assert.deepEqual(editor.get().selection.atoms, [1, 2])
  assert.equal(editor.get().bracketKind, "repeat")
  editor.undo()
  assert.equal(editor.latest().brackets, undefined, "one step")
  assert.equal(toolLabel("bracket", editor.get()), "方括号（重复单元 [ ]n）")
})

test("the attachment tool: dragged from an atom across both rings of naphthalene, it hangs from every free position of the two, in one step", () => {
  const { editor, lone, centres, press, move, release, shown } = naphthalene("attach")
  press(lone)
  move(centres[0])
  assert.equal(shown.preview?.kind, "sweep")
  assert.equal(shown.preview?.kind === "sweep" && shown.preview.rings.length, 1, "the first ring is shown")
  move({ x: (centres[0].x + centres[1].x) / 2, y: centres[0].y - 60 })
  move(centres[1])
  assert.equal(shown.preview?.kind === "sweep" && shown.preview.rings.length, 2, "then both")
  assert.equal(shown.preview?.kind === "sweep" && shown.preview.positions.length, 8)
  // Leaving the rings keeps them: what was passed over counts.
  release({ x: centres[1].x + 200, y: centres[1].y })
  const drawing = editor.latest()
  assert.deepEqual(drawing.attachments, [{ atom: lone.id, to: freePositions(drawing.molecule).sort((a, b) => a - b) }])
  assert.equal(drawing.molecule.bonds.length, 11, "no bond is drawn")
  editor.undo()
  assert.equal(editor.latest().attachments, undefined)
})

test("the attachment tool from empty canvas makes an R group there; over no ring it makes nothing", () => {
  const { editor, centres, drag } = naphthalene("attach")
  const atoms = editor.latest().molecule.atoms.length
  const start = { x: centres[0].x - 150, y: centres[0].y }
  drag(start, centres[0])
  const drawing = editor.latest()
  const made = drawing.molecule.atoms.at(-1)!
  assert.equal(drawing.molecule.atoms.length, atoms + 1)
  assert.deepEqual({ x: made.x, y: made.y, alias: made.alias }, { x: start.x, y: start.y, alias: "R1" })
  assert.equal(drawing.attachments?.[0].atom, made.id)
  assert.equal(drawing.attachments?.[0].to.length, 4)
  // The next is R2; a drag that passes over no ring leaves nothing behind.
  drag({ x: start.x, y: start.y + 80 }, centres[1])
  assert.equal(editor.latest().molecule.atoms.at(-1)!.alias, "R2")
  const before = editor.latest()
  drag({ x: start.x, y: start.y - 300 }, { x: start.x + 40, y: start.y - 300 })
  assert.equal(editor.latest(), before)
})

test("the attachment tool pressed in a ring's middle hangs the attachment from where the drag ends", () => {
  const { editor, centres, lone, drag } = naphthalene("attach")
  drag(centres[0], centres[1], { x: centres[1].x + 150, y: centres[1].y - 90 })
  const drawing = editor.latest()
  assert.equal(drawing.molecule.atoms.at(-1)!.alias, "R1")
  assert.equal(drawing.attachments?.[0].to.length, 8)
  editor.undo()
  // Onto an existing atom, that atom.
  drag(centres[1], lone)
  assert.deepEqual(editor.latest().attachments?.map((attachment) => attachment.atom), [lone.id])
})

test("the attachment tool going into a group bracket hangs from the bracket's atoms", () => {
  const start = build([{ op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } }])
  const ring = start.molecule.atoms.map((atom) => atom.id)
  const ys = start.molecule.atoms.map((atom) => atom.y)
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2
  const right = Math.max(...start.molecule.atoms.map((atom) => atom.x))
  const editor = createEditor(run(start, [{ op: "add_bracket", atoms: ring }, { op: "place_atom", el: "C", at: { x: right + 120, y: middle } }]))
  editor.setTool("attach")
  editor.setAttachShape("loop")
  const L = editor.latest().molecule.atoms.at(-1)!
  const { drag } = fakeCanvas(editor)
  drag(L, { x: right + 60, y: middle }, { x: right + 9, y: middle })
  assert.deepEqual(editor.latest().attachments, [{ atom: L.id, to: ring }], "drawn into the bracket, not as the tool's shape")
})

test("a shape picked for the attachment tool draws new attachments so, and redraws the selected ones as one step", () => {
  const { editor, lone, centres, drag } = naphthalene("attach")
  editor.takeAttachTool("arc")
  drag(lone, centres[0])
  assert.equal(editor.latest().attachments?.[0].shape, "arc")
  editor.setSelection({ atoms: [lone.id], bonds: [] })
  editor.takeAttachTool("line")
  assert.equal(editor.latest().attachments?.[0].shape, "line")
  assert.equal(editor.get().attachShape, "line")
  editor.takeAttachTool(null)
  assert.equal(editor.latest().attachments?.[0].shape, undefined, "自动 takes the shape away")
  editor.undo()
  assert.equal(editor.latest().attachments?.[0].shape, "line")
  // Just taking the tool up changes nothing.
  const before = editor.latest()
  editor.takeAttachTool()
  assert.equal(editor.latest(), before)
  assert.equal(toolLabel("attach", editor.get()), "可变连接（自动）", "the tool keeps the last shape picked; undo is for the drawing")
})
