import assert from "node:assert/strict"
import test from "node:test"
import type { Molecule, Point } from "@structura/core/types"
import { pointerDown, pointerMove, pointerUp } from "../../src/gestures/index.ts"
import type { Gesture, PointerHost, Preview } from "../../src/gestures/types.ts"
import type { HoverTarget } from "../../src/pointer/types.ts"
import { createEditor, type Editor } from "../../src/state/editor.ts"
import type { ToolId } from "../../src/tools/types.ts"

/**
 * A canvas without a screen: screen and drawing coordinates are the same, zoom is 1, and
 * what gestures show (preview, draft, hover) is kept for the test to look at.
 */
function canvas(editor: Editor) {
  const shown = { preview: null as Preview, draft: null as Molecule | null, hover: null as HoverTarget }
  const host: PointerHost = {
    get props() {
      const state = editor.get()
      return { ...state, mol: editor.latest().molecule, run: editor.run, setSelection: editor.setSelection }
    },
    gesture: { current: { kind: "idle" } as Gesture },
    space: { current: false },
    zoom: () => 1,
    pan: () => ({ x: 0, y: 0 }),
    toWorld: (x, y) => ({ x, y }),
    setView: () => {},
    setPreview: (preview) => (shown.preview = preview),
    setDraft: (draft) => (shown.draft = draft),
    setPanning: () => {},
    assignHover: (hover) => (shown.hover = hover),
    setCursor: () => {},
    setRotating: () => {},
    setRingHint: () => {},
  }
  const at = (point: Point, extra: Partial<{ shiftKey: boolean; altKey: boolean }> = {}) => ({ button: 0, clientX: point.x, clientY: point.y, shiftKey: false, altKey: false, ...extra })
  return {
    shown,
    host,
    /** Press, move through the points, let go at the last. */
    drag(from: Point, ...through: Point[]) {
      pointerDown(host, at(from))
      for (const point of through) pointerMove(host, at(point))
      pointerUp(host, at(through.at(-1) ?? from))
    },
    click: (point: Point, extra?: { shiftKey?: boolean }) => {
      pointerDown(host, at(point, extra))
      pointerUp(host, at(point, extra))
    },
  }
}

const withTool = (tool: ToolId) => {
  const editor = createEditor()
  editor.setTool(tool)
  return { editor, ...canvas(editor) }
}
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
  const lasso = canvas(editor)
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
  canvas(editor).click({ x: 0, y: 0 })
  editor.setTool("bond")
  canvas(editor).click({ x: 300, y: 0 })
  editor.setTool("marquee")
  drag({ x: -60, y: -60 }, { x: 60, y: 60 })
  assert.equal(editor.get().selection.atoms.length, 6)
  const { host } = canvas(editor)
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
