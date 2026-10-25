import assert from "node:assert/strict"
import test from "node:test"
import type { Point } from "@structura/core/types"
import { createFingers, pinchedView, pointerDown, pointerMove, pointerUp, type Editor, type FingerHost, type FingerInput, type View } from "@structura/engine"
import { withTool } from "@structura/testkit/engine"

// Touches on the canvas: one finger draws as a mouse does, two pan and pinch the view.

/**
 * A fake canvas whose touches go through the fingers: screen and drawing coordinates are the
 * same until the view moves, which it keeps (setView) for the test.
 */
function touchCanvas(tool: Parameters<typeof withTool>[0]) {
  const canvas = withTool(tool)
  const { host, shown } = canvas
  let view: View = { zoom: 1, pan: { x: 0, y: 0 } }
  let cancels = 0
  const fingerHost: FingerHost<FingerInput> = {
    zoom: () => view.zoom,
    pan: () => view.pan,
    toWorld: (x, y) => ({ x: (x - view.pan.x) / view.zoom, y: (y - view.pan.y) / view.zoom }),
    setView: (zoom, pan) => (view = { zoom, pan }),
    press: (event) => pointerDown(host, event),
    move: (event) => pointerMove(host, event),
    release: (event) => pointerUp(host, event),
    cancel() {
      cancels++
      host.gesture.current = { kind: "idle" }
      shown.preview = null
      shown.draft = null
    },
  }
  const fingers = createFingers<FingerInput>()
  const at = (id: number, point: Point, pointerType = "touch"): FingerInput => ({ pointerId: id, pointerType, button: 0, clientX: point.x, clientY: point.y, shiftKey: false, altKey: false })
  return {
    ...canvas,
    view: () => view,
    cancels: () => cancels,
    down: (id: number, point: Point, type?: string) => fingers.down(fingerHost, at(id, point, type)),
    move: (id: number, point: Point, type?: string) => fingers.move(fingerHost, at(id, point, type)),
    up: (id: number, point: Point, type?: string) => fingers.up(fingerHost, at(id, point, type)),
    lost: (id: number, point: Point) => fingers.cancel(fingerHost, at(id, point)),
  }
}

const steps = (editor: Editor) => editor.get().history.past.length

test("one finger draws as a mouse does: a tap draws a bond, a drag draws to where it ends", () => {
  const { editor, down, move, up } = touchCanvas("bond")
  down(1, { x: 0, y: 0 })
  up(1, { x: 0, y: 0 })
  assert.equal(editor.latest().molecule.atoms.length, 2)
  down(2, { x: 300, y: 0 })
  move(2, { x: 330, y: 20 })
  move(2, { x: 340, y: 60 })
  up(2, { x: 340, y: 60 })
  assert.equal(editor.latest().molecule.atoms.length, 4)
  assert.equal(steps(editor), 2)
})

test("a finger's press waits for it to move or lift, so a second finger leaves no edit, even with a tool that acts on press", () => {
  const ring = touchCanvas("ring")
  ring.down(1, { x: 0, y: 0 })
  assert.equal(ring.editor.latest().molecule.atoms.length, 0, "nothing yet: it may be the first of two fingers")
  ring.down(2, { x: 120, y: 0 })
  ring.up(1, { x: 0, y: 0 })
  ring.up(2, { x: 120, y: 0 })
  assert.equal(ring.editor.latest().molecule.atoms.length, 0)
  assert.equal(steps(ring.editor), 0)
  assert.equal(ring.cancels(), 0, "nothing had started, nothing to drop")
})

test("a second finger down mid-drag drops the drag: no half-drawn bond, no box, nothing in the history", () => {
  const bond = touchCanvas("bond")
  bond.down(1, { x: 0, y: 0 })
  bond.move(1, { x: 40, y: 30 })
  assert.equal(bond.host.gesture.current.kind, "bond")
  bond.down(2, { x: 200, y: 0 })
  assert.equal(bond.host.gesture.current.kind, "idle")
  assert.equal(bond.shown.preview, null)
  assert.equal(bond.cancels(), 1)
  bond.move(1, { x: 60, y: 50 })
  bond.up(1, { x: 60, y: 50 })
  bond.up(2, { x: 200, y: 0 })
  assert.equal(bond.editor.latest().molecule.atoms.length, 0)
  assert.equal(steps(bond.editor), 0)

  const box = touchCanvas("marquee")
  box.down(1, { x: 0, y: 0 })
  box.move(1, { x: 50, y: 50 })
  assert.equal(box.shown.preview?.kind, "marquee")
  box.down(2, { x: 200, y: 200 })
  assert.equal(box.shown.preview, null)
  assert.equal(box.host.gesture.current.kind, "idle")
})

test("two fingers moving together pan the view by as much", () => {
  const { down, move, view, editor } = touchCanvas("bond")
  down(1, { x: 100, y: 100 })
  down(2, { x: 200, y: 100 })
  move(1, { x: 130, y: 120 })
  move(2, { x: 230, y: 120 })
  assert.deepEqual(view(), { zoom: 1, pan: { x: 30, y: 20 } })
  assert.equal(editor.latest().molecule.atoms.length, 0)
})

test("a pinch zooms by the fingers' spread, about the point between them", () => {
  const { down, move, view } = touchCanvas("bond")
  down(1, { x: 100, y: 100 })
  down(2, { x: 200, y: 100 })
  move(1, { x: 50, y: 100 })
  move(2, { x: 250, y: 100 })
  // Spread 100 → 200: twice the zoom, and the drawing point (150, 100) still between the fingers.
  assert.deepEqual(view(), { zoom: 2, pan: { x: -150, y: -100 } })
})

test("pinchedView keeps the drawing point under the fingers' middle there, wherever the canvas sits", () => {
  const offset = { x: 40, y: 70 }
  const start: View = { zoom: 1.5, pan: { x: 12, y: -30 } }
  const toWorld = (view: View, p: Point) => ({ x: (p.x - offset.x - view.pan.x) / view.zoom, y: (p.y - offset.y - view.pan.y) / view.zoom })
  const from: [Point, Point] = [{ x: 300, y: 200 }, { x: 400, y: 260 }]
  const to: [Point, Point] = [{ x: 280, y: 150 }, { x: 460, y: 240 }]
  const world = toWorld(start, { x: 350, y: 230 })
  const next = pinchedView(start, world, from, to)
  const spread = (pair: [Point, Point]) => Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y)
  assert.ok(Math.abs(next.zoom - (1.5 * spread(to)) / spread(from)) < 1e-9)
  const after = toWorld(next, { x: 370, y: 195 })
  assert.ok(Math.abs(after.x - world.x) < 1e-9 && Math.abs(after.y - world.y) < 1e-9)
  assert.equal(pinchedView(start, world, from, [{ x: 0, y: 0 }, { x: 4000, y: 0 }]).zoom, 4, "held to the zoom limits")
})

test("after a pinch, the finger left behind draws nothing until all have lifted; then one finger draws again", () => {
  const { down, move, up, view, editor, host } = touchCanvas("bond")
  down(1, { x: 100, y: 100 })
  down(2, { x: 200, y: 100 })
  move(2, { x: 220, y: 100 })
  up(2, { x: 220, y: 100 })
  const still = view()
  move(1, { x: 160, y: 160 })
  move(1, { x: 220, y: 220 })
  assert.equal(host.gesture.current.kind, "idle")
  assert.deepEqual(view(), still, "nor does it pan")
  up(1, { x: 220, y: 220 })
  assert.equal(editor.latest().molecule.atoms.length, 0)
  down(3, { x: 0, y: 0 })
  up(3, { x: 0, y: 0 })
  assert.equal(editor.latest().molecule.atoms.length, 2)
})

test("a finger put back down beside the one left pinches afresh; a third finger changes nothing", () => {
  const { down, move, up, view } = touchCanvas("bond")
  down(1, { x: 100, y: 100 })
  down(2, { x: 200, y: 100 })
  down(3, { x: 500, y: 500 })
  move(3, { x: 600, y: 600 })
  assert.deepEqual(view(), { zoom: 1, pan: { x: 0, y: 0 } })
  move(2, { x: 300, y: 100 })
  assert.deepEqual(view(), { zoom: 2, pan: { x: -100, y: -100 } })
  // Finger 2 lifts: 1 and 3 are the pair now, from where they are.
  up(2, { x: 300, y: 100 })
  assert.deepEqual(view(), { zoom: 2, pan: { x: -100, y: -100 } }, "lifting a finger does not move the view")
  move(1, { x: 125, y: 100 })
  move(3, { x: 625, y: 600 })
  assert.deepEqual(view(), { zoom: 2, pan: { x: -75, y: -100 } }, "both 25 px right: the same spread, panned by as much")
})

test("a touch the browser takes back drops the gesture with no edit; mouse and pen go straight through", () => {
  const touch = touchCanvas("bond")
  touch.down(1, { x: 0, y: 0 })
  touch.move(1, { x: 40, y: 30 })
  touch.lost(1, { x: 40, y: 30 })
  assert.equal(touch.cancels(), 1)
  assert.equal(touch.editor.latest().molecule.atoms.length, 0)

  const mouse = touchCanvas("ring")
  mouse.down(1, { x: 0, y: 0 }, "mouse")
  assert.equal(mouse.editor.latest().molecule.atoms.length, 6, "a mouse press acts at once, as before")
  mouse.up(1, { x: 0, y: 0 }, "mouse")
  mouse.down(1, { x: 300, y: 0 }, "pen")
  assert.equal(mouse.editor.latest().molecule.atoms.length, 12)
})
