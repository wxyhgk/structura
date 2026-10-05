import assert from "node:assert/strict"
import test from "node:test"
import { clampZoom, createViewport, fittedView, zoomedAt } from "../../src/view/viewport.ts"

const box = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }) }

test("zooming keeps the point under the cursor still", () => {
  const view = { zoom: 1, pan: { x: 20, y: -10 } }
  const next = zoomedAt(view, { x: 300, y: 200 }, 2)
  assert.equal(next.zoom, 2)
  // World point under (300, 200) before: (280, 210); it maps back to the same screen point.
  assert.deepEqual({ x: next.pan.x + 280 * 2, y: next.pan.y + 210 * 2 }, { x: 300, y: 200 })
})

test("zoom stays between 25% and 400%", () => {
  assert.equal(clampZoom(10), 4)
  assert.equal(clampZoom(0.01), 0.25)
  assert.equal(zoomedAt({ zoom: 4, pan: { x: 0, y: 0 } }, { x: 0, y: 0 }, 2).zoom, 4)
})

test("fitting centres the points, caps the zoom at 150%, and needs points", () => {
  assert.equal(fittedView([], 800, 600), null)
  const small = fittedView([{ x: 0, y: 0 }, { x: 10, y: 0 }], 800, 600)!
  assert.equal(small.zoom, 1.5)
  assert.deepEqual(small.pan, { x: 400 - 5 * 1.5, y: 300 })
  const wide = fittedView([{ x: 0, y: 0 }, { x: 1880, y: 0 }], 800, 600)!
  assert.equal(wide.zoom, 0.4)
})

test("the viewport notifies on every change and maps screen to world through its element", () => {
  const viewport = createViewport()
  let calls = 0
  const stop = viewport.subscribe(() => calls++)
  viewport.zoomBy(2)
  assert.equal(viewport.get().zoom, 1, "no element yet, nothing to zoom around")
  viewport.attach(box)
  viewport.zoomBy(2)
  assert.deepEqual(viewport.get(), { zoom: 2, pan: { x: -400, y: -300 } })
  assert.deepEqual(viewport.toWorld(500, 350), { x: 400, y: 300 })
  viewport.reset()
  assert.deepEqual(viewport.get(), { zoom: 1, pan: { x: 0, y: 0 } })
  stop()
  viewport.zoomBy(2)
  assert.equal(calls, 2)
})

test("new content lands in the middle of the canvas the user is looking at", () => {
  const viewport = createViewport()
  viewport.attach(box as unknown as Element)
  assert.deepEqual(viewport.centre(), { x: 400, y: 300 })
  viewport.zoomBy(2)
  assert.deepEqual(viewport.centre(), { x: 400, y: 300 }, "zooming about the middle keeps the middle")
})
