import assert from "node:assert/strict"
import test from "node:test"
import { bracketMarks } from "@structura/core/draw"
import { readMolfile } from "@structura/core/sdf"
import type { Drawing } from "@structura/core/types"
import { bracketAt, contextAtoms, contextTarget, createEditor, pointerDown, pointerMove, pointerUp } from "@structura/engine"
import { build, run } from "@structura/testkit"
import { fakeCanvas } from "@structura/testkit/engine"

/** A chain of four carbons, the middle two in a repeat bracket. */
const drawing = (): Drawing =>
  build([
    { op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }, { x: 105, y: -20 }] },
    { op: "add_bracket", atoms: [2, 3], kind: "repeat" },
  ])

/** A point on "[" near its top, clear of the bond running through its middle. */
function onOpen(start: Drawing) {
  const [mark] = bracketMarks(start.molecule, start.brackets)
  const [, top] = mark.figures[0].points
  return { x: top.x, y: top.y + 3 }
}

test("a bracket is hit on its strokes, within a few pixels at any zoom, and not elsewhere", () => {
  const start = drawing()
  const point = onOpen(start)
  assert.equal(bracketAt(start.molecule, start.brackets, point, 1)?.id, 1)
  assert.equal(bracketAt(start.molecule, start.brackets, { x: point.x - 5, y: point.y }, 1)?.id, 1)
  assert.equal(bracketAt(start.molecule, start.brackets, { x: point.x - 5, y: point.y }, 4), null, "zoomed in, the reach shrinks")
  assert.equal(bracketAt(start.molecule, start.brackets, { x: point.x + 20, y: point.y }, 1), null)
  assert.equal(bracketAt(start.molecule, undefined, point, 1), null)
})

test("right-clicking a bracket's stroke gives its menu; an atom or bond there still wins", () => {
  const start = drawing()
  const none = { atoms: [], bonds: [] }
  assert.deepEqual(contextTarget(start.molecule, none, null, 1), { kind: "bracket", id: 1 })
  assert.deepEqual(contextTarget(start.molecule, none, { type: "atom", id: 2 }, 1), { kind: "atom", id: 2 })
  assert.deepEqual(contextAtoms(start.molecule, none, { kind: "bracket", id: 1 }, start.brackets), [2, 3])
})

test("pressing a bracket with a select tool selects its atoms, and dragging takes the bracket along", () => {
  const editor = createEditor(drawing())
  editor.setTool("lasso")
  const canvas = fakeCanvas(editor)
  const point = onOpen(editor.latest())
  canvas.drag(point, { x: point.x + 30, y: point.y + 10 })
  assert.deepEqual(editor.get().selection.atoms, [2, 3])
  const moved = editor.latest().molecule.atoms.find((atom) => atom.id === 2)!
  assert.deepEqual({ x: moved.x, y: moved.y }, { x: 65, y: -10 })
  assert.deepEqual(editor.latest().brackets?.[0].atoms, [2, 3])
})

test("the bracket command brackets the selection, undo takes it away, and copying keeps it", () => {
  const editor = createEditor(build([{ op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }] }]))
  editor.setSelection({ atoms: [2, 3], bonds: [] })
  editor.bracketSelection()
  assert.deepEqual(editor.latest().brackets, [{ id: 1, atoms: [2, 3], kind: "group" }])
  assert.deepEqual(editor.get().selection.atoms, [2, 3], "the selection stays")
  const copied = readMolfile(editor.selectionMolfile()!)
  assert.deepEqual(copied.brackets, [{ id: 1, atoms: [1, 2], kind: "group" }])
  editor.setSelection({ atoms: [1, 2], bonds: [] })
  assert.equal(readMolfile(editor.selectionMolfile()!).brackets, undefined, "a bracket only partly selected stays behind")
  editor.undo()
  assert.equal(editor.latest().brackets, undefined)
})

const event = (point: { x: number; y: number }) => ({ button: 0, clientX: point.x, clientY: point.y, shiftKey: false, altKey: false })

/** Naphthalene in a group bracket and a lone carbon to its right, level with its middle, with the bond tool. */
function bracketedNaphthalene() {
  const start = build([{ op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } }])
  const ring = start.molecule.atoms.map((atom) => atom.id)
  const ys = start.molecule.atoms.map((atom) => atom.y)
  const middle = (Math.min(...ys) + Math.max(...ys)) / 2
  const right = Math.max(...start.molecule.atoms.map((atom) => atom.x))
  const editor = createEditor(
    run(start, [
      { op: "add_bracket", atoms: ring },
      { op: "place_atom", el: "C", at: { x: right + 120, y: middle } },
    ]),
  )
  editor.setTool("bond")
  return { editor, ring, middle, right, L: editor.latest().molecule.atoms.at(-1)!, ...fakeCanvas(editor) }
}

test("a bond dragged from an outside atom into a group bracket, on no atom, attaches into the bracket in one step", () => {
  const { editor, ring, middle, right, L, host, shown } = bracketedNaphthalene()
  // Let go between the right-hand ring and "]": inside the bracket, on no atom and in no ring (on its edge bond).
  const inside = { x: right + 9, y: middle }
  pointerDown(host, event(L))
  pointerMove(host, event(inside))
  assert.equal(shown.preview?.kind, "attachment", "the preview shows the bond into the bracket")
  assert.ok(shown.preview?.kind === "attachment" && shown.preview.end != null)
  pointerUp(host, event(inside))
  const drawing = editor.latest()
  assert.equal(drawing.molecule.bonds.length, 11, "no ordinary bond is drawn")
  assert.deepEqual(drawing.attachments, [{ atom: L.id, to: ring }])
  editor.undo()
  assert.equal(editor.latest().attachments, undefined)
  // Out of the bracket it is an ordinary bond again.
  const outside = { x: right + 60, y: middle - 40 }
  pointerDown(host, event(L))
  pointerMove(host, event(outside))
  pointerUp(host, event(outside))
  assert.equal(editor.latest().attachments, undefined)
  assert.equal(editor.latest().molecule.bonds.length, 12)
})

test("into a ring's middle inside a bracket, it is still a ring attachment", () => {
  const { editor, ring, L, host } = bracketedNaphthalene()
  const first = editor.latest().molecule.atoms.filter((atom) => [1, 2, 3, 4, 5, 6].includes(atom.id))
  const centre = { x: first.reduce((sum, atom) => sum + atom.x, 0) / 6, y: first.reduce((sum, atom) => sum + atom.y, 0) / 6 }
  pointerDown(host, event(L))
  pointerMove(host, event(centre))
  pointerUp(host, event(centre))
  const [attachment] = editor.latest().attachments!
  assert.ok(attachment.to.length < ring.length, "one ring's free positions, not the whole bracket")
})
