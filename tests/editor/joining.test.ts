import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { snappedMove } from "../../src/editor/canvas/moveSnap.ts"
import { joinOps, scaffoldOps } from "../../src/editor/ops.ts"
import { defaultPick } from "../../src/editor/tools/scaffoldPick.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : result.error)
  return result.drawing
}

/** Two separate bonds: 1–2 and 3–4. */
const twoBonds = () =>
  run(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, angle: 0 },
    { op: "place_atom", el: "C", at: { x: 200, y: 0 } },
    { op: "add_atom", el: "C", to: 3, angle: 0 },
  ])

test("⌘J joins two atoms or two bonds of two pieces, and nothing else", () => {
  const mol = twoBonds().molecule
  assert.deepEqual(joinOps(mol, { atoms: [2, 3], bonds: [] }), [{ op: "join", atoms: [2, 3] }])
  assert.deepEqual(joinOps(mol, { atoms: [1, 2, 3, 4], bonds: [1, 2] }), [{ op: "join", bonds: [1, 2] }])
  assert.equal(joinOps(mol, { atoms: [1, 2], bonds: [] }), null, "two atoms of one piece")
  assert.equal(joinOps(mol, { atoms: [1], bonds: [] }), null)
  assert.equal(joinOps(mol, { atoms: [1, 2, 3], bonds: [] }), null)
  const joined = run(twoBonds(), joinOps(mol, { atoms: [2, 3], bonds: [] })!)
  assert.equal(joined.molecule.atoms.length, 3)
})

test("a drag that comes near an atom snaps onto it exactly, so letting go always joins", () => {
  const drawing = twoBonds()
  const two = drawing.molecule.atoms.find((atom) => atom.id === 2)!
  const three = drawing.molecule.atoms.find((atom) => atom.id === 3)!
  // Dragged to a few pixels short of atom 3.
  const snap = snappedMove(drawing.molecule, [2], three.x - two.x - 5, 4, 1)
  assert.equal(snap.target, 3)
  assert.equal(two.x + snap.dx, three.x)
  assert.equal(two.y + snap.dy, three.y)
  const joined = run(drawing, [{ op: "move", atoms: [2], dx: snap.dx, dy: snap.dy, join: true }])
  assert.equal(joined.molecule.atoms.length, 3)
  // Far from any atom: no snap, the drag is as it was.
  assert.deepEqual(snappedMove(drawing.molecule, [2], 50, 60, 1), { dx: 50, dy: 60, target: null })
})

test("the chosen scaffold becomes one op: joined on an atom, fused on a bond, standing on empty canvas", () => {
  const carbazole = defaultPick("carbazole")
  assert.deepEqual(carbazole, { name: "carbazole", site: "N9", edge: "a" })
  assert.deepEqual(defaultPick("furan").edge, "b")
  assert.deepEqual(scaffoldOps(carbazole, { type: "atom", id: 7 }, { x: 0, y: 0 }), [{ op: "add_scaffold", name: "carbazole", site: "N9", to: 7 }])
  assert.deepEqual(scaffoldOps(carbazole, { type: "bond", id: 3 }, { x: 0, y: 0 }), [{ op: "add_scaffold", name: "carbazole", edge: "a", onto: 3 }])
  assert.deepEqual(scaffoldOps(carbazole, null, { x: 5, y: 6 }), [{ op: "add_scaffold", name: "carbazole", at: { x: 5, y: 6 } }])
})
