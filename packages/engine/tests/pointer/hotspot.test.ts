import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { applyOps } from "@structura/core/ops"
import { createHotspot } from "../../src/pointer/hotspot.ts"

const mol = (() => {
  const result = applyOps(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, angle: 0 },
    { op: "add_atom", el: "C", to: 2 },
  ])
  assert.ok(result.ok)
  return result.drawing.molecule
})()

test("the pointer's atom wins, else the pinned hotspot; a pin lets go when the pointer moves onto something else", () => {
  const hotspot = createHotspot()
  let renders = 0
  hotspot.subscribe(() => renders++)
  hotspot.track(10, 10, () => ({ type: "atom", id: 2 }))
  hotspot.assignHover({ type: "atom", id: 2 })
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 2 })
  // A key on atom 2 grew atom 3 and pinned it: the next key goes to 3 while the pointer rests on 2.
  hotspot.remember({ type: "atom", id: 3 }, mol)
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 3 })
  // A small jitter keeps the pin.
  hotspot.track(13, 12, () => ({ type: "atom", id: 2 }))
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 3 })
  // Moving onto atom 1 lets go: the pointer's atom wins.
  hotspot.assignHover({ type: "atom", id: 1 })
  hotspot.track(60, 10, () => ({ type: "atom", id: 1 }))
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 1 })
  assert.equal(hotspot.view().pinnedId, null)
  assert.ok(renders >= 3, "views hear every change")
})

test("with nothing under the pointer, a pin is where keys go; clearing the hover leaves it", () => {
  const hotspot = createHotspot()
  hotspot.pin(3)
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 3 })
  hotspot.clearHover()
  assert.deepEqual(hotspot.active(mol), { type: "atom", id: 3 })
  hotspot.unpin()
  assert.equal(hotspot.active(mol), null)
})
