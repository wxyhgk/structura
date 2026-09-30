import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "../../src/chem/document.ts"
import { emptyDrawing } from "../../src/chem/drawing.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { ringPositionsAt } from "../../src/chem/markush/pointer.ts"
import { linkerNames, siteKind } from "../../src/chem/markush/sites.ts"
import { enumerate } from "../../src/chem/markush/enumerate.ts"
import { applyOps, type Op } from "../../src/chem/ops.ts"
import type { Drawing } from "../../src/chem/types.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing
}

const label = (text: string) => ({ kind: "label" as const, text })

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

test("a variable attachment is placed at each candidate in turn, displacing the R there", () => {
  const result = enumerate(formula())
  // On atom 1 or 3, R2 still chooses H or F; on atom 2, –L–ETU takes R2's place.
  assert.equal(result.total, 5)
  assert.deepEqual([result.molecules.length, result.failed], [5, 0])
  const formulas = result.molecules.map((mol) => plainFormula(mol)).sort()
  assert.deepEqual(formulas, ["C12H10O", "C12H10O", "C12H10O", "C12H9FO", "C12H9FO"])
  for (const mol of result.molecules) assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
})

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

function closestPair(mol: Drawing["molecule"]): number {
  let best = Infinity
  for (const [index, a] of mol.atoms.entries()) for (const b of mol.atoms.slice(index + 1)) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y))
  return best
}

test("a linker such as L becomes a single bond or a divalent ring between its two neighbours", () => {
  const drawing = run(formula(), [
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bond" }, { kind: "class", class: "arylene", min: 6, max: 30 }, { kind: "class", class: "heteroarylene" }] },
  ])
  const result = enumerate(drawing, { representatives: true })
  assert.deepEqual(
    result.represented.L?.map((choice) => (choice.kind === "bridge" ? choice.name : "")),
    ["p-phenylene", "m-phenylene", "4,4'-biphenylene", "2,5-pyridinediyl"],
  )
  assert.equal(result.total, 15, "3 positions × (bond + 4 bridges)")
  assert.deepEqual([result.molecules.length, result.failed], [15, 0], JSON.stringify(result.failures))
  const formulas = new Set(result.molecules.map((mol) => plainFormula(mol)))
  assert.deepEqual([...formulas].sort(), ["C12H10", "C17H13N", "C18H14", "C24H18"], "biphenyl, pyridine, terphenyl, quaterphenyl")
  for (const mol of result.molecules) {
    assert.ok(mol.atoms.every((atom) => !atom.alias))
    assert.ok(closestPair(mol) > 0.6 * 40, `closest pair ${closestPair(mol).toFixed(1)}`)
  }
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

test("a linker can be given a divalent ring directly", () => {
  const drawing = run(formula(), [
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bridge", name: "p-phenylene" }] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual([result.molecules.length, result.failed], [3, 0])
  assert.ok(result.molecules.every((mol) => plainFormula(mol) === "C18H14"), "terphenyl at each position")
  assert.ok(!applyOps(drawing, [{ op: "set_variable", name: "L", alternatives: [{ kind: "bridge", name: "o-phenylene" as "p-phenylene" }] }]).ok)
})

test("one rule says how a placeholder sits, for the panel and for enumeration alike", () => {
  const drawing = formula()
  // L (atom 8) has one bond so far, plus the one its attachment will make.
  assert.equal(siteKind(drawing, 8), "link")
  assert.equal(siteKind(drawing, 9), "end", "ETU ends the branch")
  assert.equal(siteKind(drawing, 1), "ring")
  assert.deepEqual([...linkerNames(drawing)], ["L"])
  const loose = run(drawing, [{ op: "remove_attachment", atom: 8 }])
  assert.equal(siteKind(loose, 8), "end")
  assert.deepEqual([...linkerNames(loose)], [])
})
