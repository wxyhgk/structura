import assert from "node:assert/strict"
import test from "node:test"
import { pointerDown, pointerMove, pointerUp, type Editor } from "@structura/engine"
import { fakeCanvas, withTool } from "@structura/testkit/engine"

const atoms = (editor: Editor) => editor.latest().molecule.atoms

test("the bond tool: a click on empty canvas draws a bond, a drag from its end draws another", () => {
  const { editor, click, drag } = withTool("bond")
  click({ x: 0, y: 0 })
  assert.equal(atoms(editor).length, 2)
  const end = atoms(editor)[1]
  drag({ x: end.x, y: end.y }, { x: end.x + 20, y: end.y + 30 }, { x: end.x + 20, y: end.y + 40 })
  assert.equal(atoms(editor).length, 3)
  assert.equal(editor.latest().molecule.bonds.length, 2)
})

test("the chain tool: a drag draws a zigzag as long as the drag; the preview shows it on the way", () => {
  const { editor, host, shown } = withTool("chain")
  pointerDown(host, { button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false })
  pointerMove(host, { button: 0, clientX: 130, clientY: 0, shiftKey: false, altKey: false })
  assert.equal(shown.preview?.kind, "chain")
  pointerUp(host, { button: 0, clientX: 130, clientY: 0, shiftKey: false, altKey: false })
  assert.ok(atoms(editor).length >= 4)
})

test("a ring click places a ring; dragging an atom onto another joins them", () => {
  const { editor, click } = withTool("ring")
  click({ x: 0, y: 0 })
  assert.equal(atoms(editor).length, 6)
  const lasso = fakeCanvas(editor)
  editor.setTool("bond")
  lasso.click({ x: 300, y: 0 })
  editor.setTool("lasso")
  const lone = atoms(editor).find((atom) => atom.x > 250)!
  const ringAtom = atoms(editor)[0]
  lasso.drag({ x: lone.x, y: lone.y }, { x: ringAtom.x + 3, y: ringAtom.y + 2 })
  assert.equal(atoms(editor).length, 7, "the dragged end became the ring atom")
})

test("the box select tool selects the atoms inside; Shift adds to them", () => {
  const { editor, drag } = withTool("ring")
  fakeCanvas(editor).click({ x: 0, y: 0 })
  editor.setTool("bond")
  fakeCanvas(editor).click({ x: 300, y: 0 })
  editor.setTool("marquee")
  drag({ x: -60, y: -60 }, { x: 60, y: 60 })
  assert.equal(editor.get().selection.atoms.length, 6)
  const { host } = fakeCanvas(editor)
  pointerDown(host, { button: 0, clientX: 250, clientY: -30, shiftKey: true, altKey: false })
  pointerMove(host, { button: 0, clientX: 360, clientY: 30, shiftKey: true, altKey: false })
  pointerUp(host, { button: 0, clientX: 360, clientY: 30, shiftKey: true, altKey: false })
  assert.equal(editor.get().selection.atoms.length, 8)
})

test("the eraser removes what it is pressed on; hovering shows what the pointer is over", () => {
  const { editor, host, shown, click } = withTool("ring")
  click({ x: 0, y: 0 })
  editor.setTool("eraser")
  const first = atoms(editor)[0]
  pointerMove(host, { button: 0, clientX: first.x, clientY: first.y, shiftKey: false, altKey: false })
  assert.deepEqual(shown.hover, { type: "atom", id: first.id })
  click({ x: first.x, y: first.y })
  assert.equal(atoms(editor).length, 5)
})

test("the bond tool dragged from a ring's middle out into the open makes a substituent with a variable attachment, in one step", () => {
  const { editor, drag, shown, host } = withTool("bond")
  editor.run([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  const ring = atoms(editor)
  const centre = { x: ring.reduce((sum, atom) => sum + atom.x, 0) / 6, y: ring.reduce((sum, atom) => sum + atom.y, 0) / 6 }
  const out = { x: centre.x + 110, y: centre.y - 40 }
  pointerDown(host, { button: 0, clientX: centre.x, clientY: centre.y, shiftKey: false, altKey: false })
  pointerMove(host, { button: 0, clientX: out.x, clientY: out.y, shiftKey: false, altKey: false })
  assert.equal(shown.preview?.kind, "attachment", "the preview shows the attachment on the way")
  pointerUp(host, { button: 0, clientX: out.x, clientY: out.y, shiftKey: false, altKey: false })
  const drawing = editor.latest()
  assert.equal(drawing.molecule.atoms.length, 7)
  assert.equal(drawing.molecule.bonds.length, 6, "no ordinary bond is drawn")
  const made = drawing.molecule.atoms.at(-1)!
  assert.deepEqual({ x: Math.round(made.x), y: Math.round(made.y) }, { x: Math.round(out.x), y: Math.round(out.y) })
  assert.equal(made.alias, "R1", "it is an R group straight away")
  assert.equal(drawing.attachments?.[0].atom, made.id)
  assert.equal(drawing.attachments?.[0].to.length, 6)
  // One step: a single undo takes it all away.
  editor.undo()
  assert.equal(editor.latest().molecule.atoms.length, 6)
  // With R1 taken, the next one is R2.
  assert.ok(editor.run([{ op: "add_atom", el: "C", as: "taken" }, { op: "label", atom: "taken", text: "R1" }]))
  drag(centre, { x: centre.x - 60, y: centre.y + 60 }, out)
  assert.equal(editor.latest().molecule.atoms.at(-1)!.alias, "R2")
  editor.undo()
  editor.undo()
  // A short drag that stays inside the ring is no attachment.
  drag(centre, { x: centre.x + 8, y: centre.y + 2 }, { x: centre.x + 10, y: centre.y + 2 })
  assert.equal(editor.latest().attachments, undefined)
})
