import assert from "node:assert/strict"
import test from "node:test"
import { cubicPoint } from "@structura/core/curves"
import { structureMarks } from "@structura/core/draw"
import { curveNodes, ringSystemPositions } from "@structura/markush"
import type { Drawing, Point } from "@structura/core/types"
import { createEditor, curveKey, type Editor } from "@structura/engine"
import { build, run } from "@structura/testkit"
import { fakeCanvas } from "@structura/testkit/engine"

// Editing a custom attachment curve with the select tools, and drawing one freehand with
// the attachment tool.

const NODES: Array<[number, number]> = [
  [-60, -75],
  [0, -70],
  [60, -70],
  [130, -10],
]

/** Anthracene (atoms 1–14) with Rx (15) above it, attached anywhere on it; with a custom curve unless `plain`. */
function anthracene(plain = false): Drawing {
  const base = build([
    { op: "add_scaffold", name: "anthracene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: -40, y: -130 } },
    { op: "label", atom: 15, text: "Rx" },
  ])
  const attached = run(base, [{ op: "set_attachment", atom: 15, to: ringSystemPositions(base.molecule, [1])! }])
  return plain ? attached : run(attached, [{ op: "set_attachment_curve", atom: 15, nodes: NODES, closed: false }])
}

function editing(drawing = anthracene()) {
  const editor = createEditor(drawing)
  editor.setTool("lasso")
  return { editor, ...fakeCanvas(editor) }
}

const nodesNow = (editor: Editor) => curveNodes(editor.latest().molecule, editor.latest().attachments![0])!
/** A point on the drawn curve halfway along piece `index` (open: piece 0 runs from the atom to node 0). */
function onPiece(editor: Editor, index: number): Point {
  const drawing = editor.latest()
  const mark = structureMarks(drawing.molecule, drawing.attachments, drawing.brackets).attachments[0]
  return cubicPoint(mark.custom!.cubics[index], 0.5)
}
const at = ([x, y]: [number, number]) => ({ x, y })

test("a click on the curve picks it; a node is dragged where it should go, shown meanwhile, and lands as one undoable step", () => {
  const { editor, click, press, move, release, shown } = editing()
  editor.setSelection({ atoms: [1], bonds: [] })
  click(onPiece(editor, 2))
  assert.deepEqual(editor.get().curveFocus, { atom: 15, node: null })
  assert.deepEqual(editor.get().selection, { atoms: [], bonds: [] }, "picking the curve leaves the selection")
  const steps = editor.get().history.past.length

  press(at(NODES[1]))
  assert.deepEqual(editor.get().curveFocus, { atom: 15, node: 1 })
  move({ x: 10, y: -100 })
  assert.ok(shown.attachments, "the drag is shown before it is let go")
  assert.equal(editor.get().history.past.length, steps, "nothing is written while dragging")
  release({ x: 10, y: -100 })
  assert.equal(shown.attachments, null)
  assert.equal(editor.get().history.past.length, steps + 1)
  const moved = nodesNow(editor)
  assert.ok(Math.hypot(moved[1].x - 10, moved[1].y + 100) < 0.05)
  assert.ok(Math.hypot(moved[0].x + 60, moved[0].y + 75) < 0.05, "the other nodes stay")
  editor.undo()
  assert.ok(Math.hypot(nodesNow(editor)[1].x, nodesNow(editor)[1].y + 70) < 0.05)
})

test("a click on the picked curve between nodes puts one in there; a double click on a node, or Delete, takes it out", () => {
  const { editor, click, shown } = editing()
  click(onPiece(editor, 2))
  // Piece 2 runs from node 1 to node 2: the new node goes between them.
  const between = onPiece(editor, 2)
  click(between)
  const five = nodesNow(editor)
  assert.equal(five.length, 5)
  assert.ok(Math.hypot(five[2].x - between.x, five[2].y - between.y) < 0.05)
  assert.deepEqual(editor.get().curveFocus, { atom: 15, node: 2 })
  assert.equal(shown.attachments, null)

  // Double click on it: gone again.
  click(between, { timeStamp: 1000 })
  click(between, { timeStamp: 1200 })
  assert.equal(nodesNow(editor).length, 4)
  assert.deepEqual(editor.get().curveFocus, { atom: 15, node: null })
  // Two clicks far apart in time are two picks.
  click(at(NODES[0]), { timeStamp: 5000 })
  click(at(NODES[0]), { timeStamp: 9000 })
  assert.equal(nodesNow(editor).length, 4)

  // Delete with a node picked takes it out; never fewer than two.
  const keys = (key: string) => curveKey(key, { drawing: editor.latest(), focus: editor.get().curveFocus, setFocus: editor.setCurveFocus, run: editor.run })
  assert.ok(keys("Delete"))
  assert.equal(nodesNow(editor).length, 3)
  for (const _ of [1, 2, 3]) {
    editor.setCurveFocus({ atom: 15, node: 0 })
    keys("Backspace")
  }
  assert.equal(nodesNow(editor).length, 2)
  assert.ok(!keys("x"), "other keys go on to the rest of the editor")
  assert.ok(keys("Escape"))
  assert.equal(editor.get().curveFocus, null)
  assert.ok(!keys("Delete"), "with no curve picked, Delete is the selection's")
})

test("a press anywhere else, selecting atoms or another tool stops editing the curve; the cursor tells what is under it", () => {
  const { editor, click, move, shown } = editing()
  move(onPiece(editor, 1))
  assert.equal(shown.curveHover, "pick")
  click(onPiece(editor, 1))
  move(at(NODES[2]))
  assert.equal(shown.curveHover, "node")
  move(onPiece(editor, 3))
  assert.equal(shown.curveHover, "insert")
  move({ x: 400, y: 400 })
  assert.equal(shown.curveHover, null)
  click({ x: 400, y: 400 })
  assert.equal(editor.get().curveFocus, null)

  click(onPiece(editor, 1))
  editor.setSelection({ atoms: [3], bonds: [] })
  assert.equal(editor.get().curveFocus, null)
  click(onPiece(editor, 1))
  editor.setTool("bond")
  assert.equal(editor.get().curveFocus, null)
})

test("curves drawn the other ways are not picked, and an atom on the curve is still the atom's", () => {
  const { editor, click } = editing(anthracene(true))
  const drawing = editor.latest()
  const mark = structureMarks(drawing.molecule, drawing.attachments, drawing.brackets).attachments[0]
  click({ x: (mark.from.x + mark.to.x) / 2, y: (mark.from.y + mark.to.y) / 2 })
  assert.equal(editor.get().curveFocus, null)
})

test("the attachment tool drawing custom curves: the path dragged round the rings becomes the curve, closed when it comes back", () => {
  const editor = createEditor(anthracene(true))
  // Start afresh from a lone R group.
  editor.run([{ op: "remove_attachment", atom: 15 }])
  editor.setTool("attach")
  editor.setAttachShape("custom")
  const { drag, shown, press, move, release } = fakeCanvas(editor)
  const rx = editor.latest().molecule.atoms.find((atom) => atom.id === 15)!
  // From Rx down to above the rings, then round all three, back near where the loop began.
  const loop = Array.from({ length: 49 }, (_, i) => {
    const t = -Math.PI / 2 + (i / 48) * 2 * Math.PI
    return { x: 150 * Math.cos(t), y: 85 * Math.sin(t) }
  })
  press(rx)
  for (const point of loop) move(point)
  assert.equal(shown.preview?.kind === "sweep" && shown.preview.trail?.length, loop.length, "the path is shown as it is drawn")
  release(loop.at(-1)!)
  const made = editor.latest().attachments![0]
  assert.equal(made.shape, "custom")
  assert.equal(made.curve!.closed, true)
  assert.ok(made.curve!.nodes.length >= 4 && made.curve!.nodes.length <= 12, `${made.curve!.nodes.length} nodes`)
  assert.equal(made.to.length, 10, "every free position of the rings it went round")
  editor.undo()
  assert.equal(editor.latest().attachments, undefined, "one step")

  // An open sweep over two rings: an open curve through its corners.
  drag(rx, { x: -70, y: -60 }, { x: -70, y: 0 }, { x: 0, y: 0 }, { x: 40, y: 50 })
  const open = editor.latest().attachments![0]
  assert.equal(open.curve!.closed, false)
  assert.ok(open.curve!.nodes.length >= 2)
  const ends = curveNodes(editor.latest().molecule, open)!
  assert.ok(Math.hypot(ends.at(-1)!.x - 40, ends.at(-1)!.y - 50) < 0.05, "it ends where the drag did")
})
