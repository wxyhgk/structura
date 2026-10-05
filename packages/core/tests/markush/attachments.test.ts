import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { ringPositionsAt } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { label, run } from "@structura/testkit"

/** Benzene (atoms 1–6) with R2 on atom 2, and –L–ETU off to the side, attached to any of atoms 1, 2, 3. */
function formula(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "place_atom", el: "C", at: { x: 200, y: 0 } },
    { op: "label", atom: 8, text: "L" },
    { op: "add_atom", el: "C", to: 8, as: "etu" },
    { op: "label", atom: "etu", text: "ETU" },
    { op: "set_attachment", atom: 8, to: [1, 2, 3] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("F")] },
    { op: "set_variable", name: "L", alternatives: [label("O")] },
    { op: "set_variable", name: "ETU", alternatives: [label("Ph")] },
  ])
}

test("attachments are checked, follow deleted atoms, and are saved", () => {
  const drawing = formula()
  for (const [op, message] of [
    [{ op: "set_attachment", atom: 8, to: [1] }, /at least two/],
    [{ op: "set_attachment", atom: 8, to: [8, 1] }, /its own candidates/],
    [{ op: "remove_attachment", atom: 1 }, /no variable attachment/],
  ] as Array<[Op, RegExp]>) {
    const outcome = applyOps(drawing, [op])
    assert.ok(!outcome.ok && message.test(outcome.error), JSON.stringify(op))
  }
  const fewer = run(drawing, [{ op: "remove", atoms: [1] }])
  assert.deepEqual(fewer.attachments, [{ atom: 8, to: [2, 3] }])
  const gone = run(fewer, [{ op: "remove", atoms: [2] }])
  assert.equal(gone.attachments, undefined)
  const read = readDocument(toDocument(drawing))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing.attachments, [{ atom: 8, to: [1, 2, 3] }])
})

test("a point inside a ring picks that ring's free positions, not the fusion atoms", () => {
  const naphthalene = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_ring", bond: 1, kind: "benzene", side: 1 },
  ]).molecule
  const firstRing = naphthalene.atoms.filter((atom) => atom.id <= 6)
  const middle = { x: firstRing.reduce((sum, atom) => sum + atom.x, 0) / 6, y: firstRing.reduce((sum, atom) => sum + atom.y, 0) / 6 }
  const positions = ringPositionsAt(naphthalene, middle)
  assert.equal(positions?.length, 4)
  assert.equal(ringPositionsAt(naphthalene, { x: 900, y: 900 }), null)
})

test("replace joins a two-bond fragment's neighbours by a bond or a bridge, and only such a fragment", () => {
  const chain = run(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, as: "mid" },
    { op: "add_atom", el: "C", to: "mid" },
  ])
  const bonded = run(chain, [{ op: "replace", atoms: [2], with: { bond: true } }])
  assert.equal(plainFormula(bonded.molecule), "C2H6")
  const bridged = run(chain, [{ op: "replace", atoms: [2], with: { bridge: "p-phenylene" } }])
  assert.equal(plainFormula(bridged.molecule), "C8H10", "para-xylene")
  const end = applyOps(chain, [{ op: "replace", atoms: [3], with: { bond: true } }])
  assert.ok(!end.ok && /joined by two bonds, not 1/.test(end.error))
})

/** Benzene (atoms 1–6, centred on the origin) and a lone bond far off: atom 7 (L) and 8. */
function benzeneAndBond(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 200, y: -120 } },
    { op: "add_atom", el: "C", to: 7 },
    { op: "label", atom: 7, text: "L" },
  ])
}

test("with the drawing tools, any line that ends inside a ring becomes a variable attachment", () => {
  const start = benzeneAndBond()
  // A drawn line's new end atom goes, so the count stays; a dragged end was already there, so one goes.
  const expect = (drawing: Drawing, hub: number, why: string, atoms = start.molecule.atoms.length) => {
    assert.deepEqual(drawing.attachments, [{ atom: hub, to: [1, 2, 3, 4, 5, 6] }], why)
    assert.equal(drawing.molecule.atoms.length, atoms, `${why}: no atom is left in the ring`)
  }
  expect(run(start, [{ op: "draw_bond", from: 7, end: { x: 3, y: 2 }, ringPointer: true }]), 7, "bond from L into the ring")
  const l = start.molecule.atoms.find((atom) => atom.id === 7)!
  expect(run(start, [{ op: "draw_bond", start: { x: -2, y: 4 }, end: { x: l.x, y: l.y }, ringPointer: true }]), 7, "bond from the ring onto L")
  const chained = run(start, [{ op: "draw_chain", from: 7, points: [{ x: l.x, y: l.y }, { x: 120, y: -80 }, { x: 60, y: -40 }, { x: 5, y: 0 }], ringPointer: true }])
  assert.equal(chained.attachments?.length, 1, "a chain whose last point is in the ring")
  assert.notEqual(chained.attachments![0].atom, 7)
  expect(run(start, [{ op: "move", atoms: [8], dx: -start.molecule.atoms[7].x + 4, dy: -start.molecule.atoms[7].y - 3, ringPointer: true }]), 7, "an end atom dragged into the ring", start.molecule.atoms.length - 1)
})

test("what is meant to be inside a ring stays", () => {
  const start = benzeneAndBond()
  const oxygen = run(start, [{ op: "draw_bond", from: 7, end: { x: 3, y: 2 }, ringPointer: true }, { op: "remove_attachment", atom: 7 }, { op: "add_atom", el: "O", to: 8 }])
  assert.equal(oxygen.attachments, undefined)
  assert.equal(run(start, [{ op: "place_atom", el: "C", at: { x: 2, y: 2 } }]).attachments, undefined, "a lone atom")
  assert.equal(run(start, [{ op: "draw_bond", from: 1, end: { x: 3, y: 2 }, ringPointer: true }]).attachments, undefined, "a bond from the ring's own atom")
  // Without ringPointer (an agent's op, or enumeration moving atoms), a line into a ring stays a line.
  const plain = run(start, [{ op: "draw_bond", from: 7, end: { x: 3, y: 2 } }])
  assert.equal(plain.attachments, undefined)
  assert.equal(plain.molecule.atoms.length, start.molecule.atoms.length + 1)
})

