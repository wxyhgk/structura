import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing, Repeat } from "@structura/core/types"
import { build, label, run } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"
import { enumerate, pickFields } from "@structura/markush"

const { canonicalAll } = await chemistry()

/** Benzene (atoms 1–6) with (R1)m drawn into it: R1 is atom 7, m from `min` to `max`, R1 = Cl or F. */
function formula(repeat: Repeat): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 150, y: 0 } },
    { op: "label", atom: 7, text: "R1" },
    { op: "set_attachment", atom: 7, to: [1, 2, 3, 4, 5, 6], repeat },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("F")] },
  ])
}

/** Every set of `size` items, in order. */
function subsets<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  return items.flatMap((item, at) => subsets(items.slice(at + 1), size - 1).map((rest) => [item, ...rest]))
}

/**
 * What (R1)m on benzene must give, drawn the plain way, without any generic-formula code:
 * for each count, each set of ring atoms, each Cl/F choice per copy, benzene with those
 * substituents added by hand. The referee the enumeration is checked against.
 */
function byHand(min: number, max: number): Drawing[] {
  const expected: Drawing[] = []
  for (let size = min; size <= max; size++)
    for (const positions of subsets([1, 2, 3, 4, 5, 6], size))
      for (let pick = 0; pick < 2 ** size; pick++)
        expected.push(
          build([
            { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
            ...positions.flatMap((atom, index): Op[] => [{ op: "add_atom", el: (pick >> index) & 1 ? "F" : "Cl", to: atom }]),
          ]),
        )
  return expected
}

test("(R1)m gives exactly the molecules drawn by hand, every position set and every choice", () => {
  const result = enumerate(formula({ min: 0, max: 2, name: "m" }), { limit: 10000 })
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(byHand(0, 2)))
  const all = enumerate(formula({ min: 3, max: 4, name: "n" }), { limit: 10000 })
  assert.deepEqual(canonicalAll(all.molecules), canonicalAll(byHand(3, 4)))
})

test("(R1)m expands to every set of m positions, each copy choosing on its own", () => {
  const result = enumerate(formula({ min: 0, max: 2, name: "m" }), { limit: 10000 })
  // m = 0: one molecule; m = 1: 6 positions × 2; m = 2: 15 pairs × 2 × 2.
  assert.equal(result.total, 1 + 12 + 60)
  assert.equal(result.molecules.length, 73)
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  const formulas = new Set(result.molecules.map((mol) => plainFormula(mol)))
  assert.deepEqual([...formulas].sort(), ["C6H4Cl2", "C6H4ClF", "C6H4F2", "C6H5Cl", "C6H5F", "C6H6"])
  for (const mol of result.molecules) assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
  // Each molecule says where the copies went.
  assert.equal(pickFields(result.picks[0])["R1 position"], "none")
  assert.ok(result.picks.some((picks) => /^#\d, #\d$/.test(pickFields(picks)["R1 position"])))
})

test("a fixed count and an exact range both work", () => {
  const two = enumerate(formula({ min: 2, max: 2, name: "n" }), { limit: 10000 })
  assert.equal(two.total, 15 * 4)
  assert.ok(two.molecules.every((mol) => plainFormula(mol).startsWith("C6H4")))
  const all = enumerate(formula({ min: 6, max: 6, name: "n" }), { limit: 10000 })
  assert.equal(all.total, 2 ** 6)
  assert.ok(all.molecules.every((mol) => /^C6(Cl|F)/.test(plainFormula(mol)) && !plainFormula(mol).includes("H")))
})

test("repeat counts are checked, can be changed or dropped, and are saved", () => {
  const drawing = formula({ min: 0, max: 2, name: "m" })
  for (const [repeat, message] of [
    [{ min: 0, max: 7, name: "m" }, /at most 6/],
    [{ min: 3, max: 1, name: "m" }, /not a range/],
    [{ min: 0, max: 1.5, name: "m" }, /whole numbers/],
    [{ min: 0, max: 2, name: "R" }, /lower-case/],
  ] as const) {
    const result = applyOps(drawing, [{ op: "set_repeat", atom: 7, repeat }])
    assert.ok(!result.ok && message.test(result.error), `${JSON.stringify(repeat)}: ${result.ok ? "accepted" : result.error}`)
  }
  const changed = run(drawing, [{ op: "set_repeat", atom: 7, repeat: { min: 1, max: 3, name: "n" } }])
  assert.deepEqual(changed.attachments?.[0].repeat, { min: 1, max: 3, name: "n" })
  const once = run(changed, [{ op: "set_repeat", atom: 7, repeat: null }])
  assert.equal(once.attachments?.[0].repeat, undefined)
  assert.equal(enumerate(once).total, 6 * 2)
  const reread = readDocument(toDocument(changed))
  assert.ok("drawing" in reread)
  assert.deepEqual(reread.drawing.attachments?.[0].repeat, { min: 1, max: 3, name: "n" })
})

