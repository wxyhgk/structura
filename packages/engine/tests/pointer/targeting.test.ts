import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { applyOps } from "@structura/core/ops"
import { createEditor, hitOf, hoverOf, reachOf } from "@structura/engine"
import { fakeCanvas } from "@structura/testkit/engine"

// One bond, 40 long, from (0,0) to (40,0): what the pointer takes along and beside it.
const mol = (() => {
  const result = applyOps(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, angle: 0 },
  ])
  assert.ok(result.ok)
  return result.drawing.molecule
})()
const [a, b] = mol.atoms
const bond = { type: "bond" as const, id: mol.bonds[0].id }
const atomA = { type: "atom" as const, id: a.id }
const along = (share: number, off = 0) => ({ x: a.x + (b.x - a.x) * share, y: a.y + off })

test("what lights up under the pointer is what a press takes, everywhere around a bond, at any zoom", () => {
  for (const zoom of [0.25, 0.5, 1, 2, 4]) {
    for (let share = -0.5; share <= 1.5; share += 0.05) {
      for (let off = -20; off <= 20; off += 1) {
        const point = along(share, off / zoom)
        assert.deepEqual(hoverOf(mol, point, zoom), hitOf(mol, point, zoom), `zoom ${zoom} at ${JSON.stringify(point)}`)
      }
    }
  }
})

test("one reach for atoms and bonds: 30% of a bond's length on screen, from 8 to 16 pixels, further with a finger", () => {
  assert.equal(reachOf(mol, 1), 12, "a 40-pixel bond: 12 pixels")
  assert.equal(reachOf(mol, 2), 16 / 2, "zoomed in, no more than 16 pixels")
  assert.equal(reachOf(mol, 0.25), 8 / 0.25, "zoomed out, no less than 8")
  assert.equal(reachOf(mol, 1, true), 16, "a finger: at least 16")
  assert.equal(reachOf(mol, 4, true), 28 / 4, "and at most 28")
  // Beside the bond and round a lone end, the same distance.
  assert.deepEqual(hitOf(mol, along(0.5, 12), 1), bond)
  assert.equal(hitOf(mol, along(0.5, 13), 1), null)
  assert.deepEqual(hitOf(mol, along(-12 / 40), 1), atomA)
  assert.equal(hitOf(mol, along(-13 / 40), 1), null)
  assert.deepEqual(hitOf(mol, along(0.5, 14), 1, { coarse: true }), bond)
})

test("a bond keeps the middle of its length to itself at any zoom; its atoms keep 30% at each end, or the reach if less", () => {
  for (const zoom of [0.25, 0.5, 1, 2, 4]) {
    assert.deepEqual(hitOf(mol, along(0.5), zoom), bond, `middle at zoom ${zoom}`)
    assert.deepEqual(hitOf(mol, along(0.35), zoom), bond, `35% at zoom ${zoom}`)
    assert.deepEqual(hitOf(mol, along(0.05), zoom), atomA, `5% at zoom ${zoom}`)
  }
  for (const zoom of [0.25, 0.5, 1]) assert.deepEqual(hitOf(mol, along(0.25), zoom), atomA, `25% at zoom ${zoom}`)
  // Zoomed in to an 80-pixel bond, the atom has its 16 pixels and the bond the rest.
  assert.deepEqual(hitOf(mol, along(15 / 80), 2), atomA)
  assert.deepEqual(hitOf(mol, along(17 / 80), 2), bond)
  // Zoomed out to a 10-pixel bond, the reach (8 pixels) is wider than the atom's share: the nearer wins.
  assert.deepEqual(hitOf(mol, along(0.4, 3), 0.25), bond)
  assert.deepEqual(hitOf(mol, along(-0.1, 8), 0.25), atomA)
})

test("on a boundary the pointer stays on what the hover marked, until the other is 2 pixels nearer", () => {
  // At 50% the reach (8 pixels, 16 units) is past the atom's share (12 units): between them, the nearer wins.
  const edge = along(13 / 40)
  assert.deepEqual(hitOf(mol, edge, 0.5), bond, "just past the atom's share: the bond")
  assert.deepEqual(hitOf(mol, edge, 0.5, { keep: atomA }), atomA, "coming from the atom: still the atom")
  assert.deepEqual(hitOf(mol, along(15 / 40), 0.5, { keep: atomA }), atomA, "1.5 pixels on: still")
  assert.deepEqual(hitOf(mol, along(16.5 / 40), 0.5, { keep: atomA }), bond, "past 2 pixels: the bond")
  assert.deepEqual(hitOf(mol, along(0.25), 0.5, { keep: bond }), bond, "and back from the bond, the same")
  assert.deepEqual(hitOf(mol, along(0.5, 40), 1, { keep: atomA }), null, "nothing near: nothing, whatever was marked")
})

test("an atom with a label is hit anywhere on its label's box", () => {
  const labelled = applyOps({ ...emptyDrawing(), molecule: mol }, [{ op: "label", atom: b.id, text: "N" }])
  assert.ok(labelled.ok)
  // NH2, written to the right: 22 right of the N, on the H2, is past a bare atom's reach but on the label.
  const amine = labelled.drawing.molecule
  assert.deepEqual(hitOf(amine, { x: b.x + 22, y: b.y }, 1), { type: "atom", id: b.id })
  assert.equal(hitOf(mol, { x: b.x + 22, y: b.y }, 1), null)
})

test("a click takes what the hover marks: on a boundary, what the pointer came from", () => {
  const editor = createEditor([mol])
  editor.setTool("lasso")
  const { click, move, shown, host } = fakeCanvas(editor)
  // The canvas at 50%, where the boundary has room (see above).
  host.zoom = () => 0.5
  move(along(0.05))
  move(along(13 / 40))
  assert.deepEqual(shown.hover, atomA)
  click(along(13 / 40))
  assert.deepEqual(editor.get().selection, { atoms: [a.id], bonds: [] })
  // Straight there from nothing, the same point is the bond's.
  move(along(0.5, 100))
  move(along(13 / 40))
  assert.deepEqual(shown.hover, bond)
})
