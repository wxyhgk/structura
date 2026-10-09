import assert from "node:assert/strict"
import test from "node:test"
import { bracketMarks } from "@structura/core/draw"
import { readMolfile } from "@structura/core/sdf"
import type { Drawing } from "@structura/core/types"
import { bracketAt, contextAtoms, contextTarget, createEditor } from "@structura/engine"
import { build } from "@structura/testkit"
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
