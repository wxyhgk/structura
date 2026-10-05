import assert from "node:assert/strict"
import test from "node:test"
import { ZOOM_LEVELS, createViewport, steppedZoom } from "@structura/engine"

test("zoom steps walk the preset ladder one level at a time", () => {
  assert.equal(steppedZoom(1, 1), 1.25)
  assert.equal(steppedZoom(1, -1), 0.75)
  assert.equal(steppedZoom(0.5, 1), 0.67)
  assert.equal(steppedZoom(3, -1), 2)
})

test("from a level the wheel left, a step snaps to the next preset in that direction", () => {
  assert.equal(steppedZoom(1.1, 1), 1.25)
  assert.equal(steppedZoom(1.1, -1), 1)
  assert.equal(steppedZoom(0.3, 1), 0.33)
  assert.equal(steppedZoom(0.3, -1), 0.25)
  assert.equal(steppedZoom(1.001, 1), 1.25, "a hair off a preset counts as on it")
  assert.equal(steppedZoom(0.999, -1), 0.75)
})

test("steps stop at the ends of the ladder", () => {
  assert.equal(steppedZoom(4, 1), 4)
  assert.equal(steppedZoom(5, 1), 4)
  assert.equal(steppedZoom(0.25, -1), 0.25)
  assert.equal(steppedZoom(0.1, -1), 0.25)
  assert.deepEqual([...ZOOM_LEVELS].sort((a, b) => a - b), [...ZOOM_LEVELS])
})

test("the viewport steps around the middle of the canvas", () => {
  const viewport = createViewport()
  viewport.attach({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) })
  viewport.zoomStep(1)
  assert.equal(viewport.get().zoom, 1.25)
  assert.deepEqual(viewport.centre(), { x: 400, y: 300 })
  for (let i = 0; i < 20; i++) viewport.zoomStep(-1)
  assert.equal(viewport.get().zoom, 0.25)
})
