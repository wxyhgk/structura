import assert from "node:assert/strict"
import test from "node:test"
import type { Drawing, Molecule } from "@structura/core/types"
import type { Op } from "@structura/core/ops"
import { build, label } from "@structura/testkit"
import { enumerate, enumerateSteps, formulasOf, librarySize, pickFields, placeholders } from "@structura/markush"
import { choiceResolver } from "../src/choices.ts"
import { choose, layoutSpace, layouts, placements } from "../src/layouts.ts"
import { planFormulas, type Tally } from "../src/plans.ts"

// Big libraries: the layouts of attachments are counted and reached by index, not listed.

/** A ring system (naphthalene: atoms 1–10, the fusion carbons among them) with attachments `[hub label, candidates, repeat?]`, hubs standing alone. */
function ringWith(scaffold: string, attachments: Array<[string, number[], { min: number; max: number }?]>, more: Op[] = []): Drawing {
  const first = scaffold === "benzene" ? 7 : scaffold === "naphthalene" ? 11 : 15
  const ring: Op = scaffold === "benzene" ? { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" } : { op: "add_scaffold", name: scaffold, at: { x: 0, y: 0 } }
  const ops: Op[] = [ring, ...more]
  const names = new Set<string>()
  for (const [index, [name, to, repeat]] of attachments.entries()) {
    const atom = first + more.filter((op) => op.op === "add_atom").length + index
    ops.push({ op: "place_atom", el: "C", at: { x: 300 + 100 * index, y: 0 } }, { op: "label", atom, text: name })
    ops.push({ op: "set_attachment", atom, to, ...(repeat ? { repeat: { ...repeat, name: `n${index}` } } : {}) })
    names.add(name)
  }
  const choices: Record<string, ReturnType<typeof label>[]> = { R1: [label("H"), label("Me"), label("Cl")], R2: [label("F"), label("OMe")], R3: [label("Me")] }
  for (const name of names) ops.push({ op: "set_variable", name, alternatives: choices[name] })
  return build(ops)
}

const CH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

test("a repeated attachment's placements are counted and reached by rank, in the order they were listed", () => {
  const all = (items: number[], size: number, from = 0): number[][] =>
    size === 0 ? [[]] : items.slice(from).flatMap((item, at) => all(items, size - 1, from + at + 1).map((rest) => [item, ...rest]))
  const to = [3, 5, 8, 9, 12]
  const listed = [0, 1, 2, 3].flatMap((size) => all(to, size))
  const ways = placements({ atom: 1, to, repeat: { min: 0, max: 3, name: "m" } })
  assert.equal(ways.size, BigInt(listed.length))
  assert.deepEqual(listed.map((_, rank) => ways.at(BigInt(rank))), listed)
  assert.equal(choose(60, 30), 118264581564861424n, "exactly, however big")
  const plain = placements({ atom: 1, to })
  assert.deepEqual([plain.size, plain.at(2n)], [5n, [8]])
})

test("layouts come one by one in the same order whether listed or reached by index", () => {
  const drawing = ringWith("benzene", [["R1", [1, 2, 3], { min: 0, max: 2 }], ["R2", [4, 5]]])
  const space = layoutSpace(drawing)
  const listed = [...layouts(drawing)]
  assert.equal(space.size, BigInt(listed.length))
  assert.equal(listed.length, 7 * 2)
  assert.deepEqual([...listed.keys()].map((index) => space.at(BigInt(index))), listed)
  assert.deepEqual(space.targets(0n), [[], [4]])
  assert.deepEqual(space.targets(13n), [[2, 3], [5]])
  assert.throws(() => space.at(14n), RangeError)
})

/** What planning counts for a drawing, made layout by layout (`exact`) or without making them. */
function counted(drawing: Drawing, exact: boolean) {
  const resolver = choiceResolver(drawing.variables ?? {}, true)
  for (const { name } of placeholders(drawing)) resolver.choicesFor(name)
  const tally: Tally = { total: 0, occupied: 0, onlyClasses: [], skippedRepeats: [], straddlingAttachments: [], estimated: false }
  const planning = planFormulas(drawing, formulasOf(drawing), resolver, tally, { exact })
  while (!planning.next().done);
  return { total: tally.total, occupied: tally.occupied, onlyClasses: tally.onlyClasses, misfits: resolver.misfits, estimated: tally.estimated }
}

/** A ring placeholder on atom `at`, named `name`: R5 on the ring carbon an attachment may land on. */
const ringHolder = (at: number, name: string, id: string): Op[] => [{ op: "add_atom", el: "C", to: at, as: id }, { op: "label", atom: id, text: name }]

const cases: Array<[string, () => Drawing]> = [
  ["two repeats over the same positions", () => ringWith("naphthalene", [["R1", CH, { min: 0, max: 2 }], ["R2", CH, { min: 1, max: 3 }]])],
  ["two repeats on separate positions", () => ringWith("naphthalene", [["R1", [1, 2, 3, 4], { min: 0, max: 3 }], ["R2", [5, 6, 7, 8], { min: 0, max: 2 }]])],
  ["partly shared positions, one attachment not repeated", () => ringWith("naphthalene", [["R1", [1, 2, 3, 4, 5], { min: 0, max: 2 }], ["R2", [4, 5, 6, 7]], ["R3", [1, 7, 8, 9]]])],
  ["placeholders on the ring that attachments displace", () => ringWith("benzene", [["R1", [1, 2, 3, 4], { min: 0, max: 2 }]], [...ringHolder(1, "R2", "p1"), ...ringHolder(2, "R2", "p2")])],
  ["a shared position that carries a placeholder", () => ringWith("benzene", [["R1", [1, 2], { min: 0, max: 2 }], ["R3", [1, 2, 3]]], ringHolder(1, "R2", "p1"))],
  ["two attachments that may take the same two positions: one each, not both on one", () => ringWith("benzene", [["R1", [1, 2]], ["R2", [1, 2]]])],
  ["a repeated position list with no room at all", () => ringWith("benzene", [["R1", [1, 2], { min: 1, max: 2 }]], [{ op: "add_atom", el: "C", to: 1 }, { op: "add_atom", el: "C", to: 2 }])],
]

test("counting layouts without making them gives what making each one gives", () => {
  for (const [what, drawing] of cases) {
    const fast = counted(drawing(), false)
    assert.deepEqual(fast, counted(drawing(), true), what)
    assert.equal(fast.estimated, false, what)
  }
  // Two CH carbons, two attachments, one each: R1 (3) and R2 (2) either way round.
  assert.deepEqual(counted(cases[5][1](), false), { total: 12, occupied: 2, onlyClasses: [], misfits: {}, estimated: false })
  assert.equal(counted(cases[6][1](), false).total, 0)
})

test("a placement that finds a position taken by another attachment's piece is left out, not written over it", () => {
  const made = enumerate(cases[5][1]())
  assert.deepEqual([made.total, made.occupied, made.molecules.length], [12, 2, 12])
  for (const fields of made.picks.map((picks) => pickFields(picks))) assert.ok(fields.R1 && fields.R2, "each attachment's piece is there")
})

/** A small formula with many compounds, for picking some of them: three variables of five choices each. */
function many(): Drawing {
  const choices = [label("H"), label("Me"), label("F"), label("Cl"), label("OMe")]
  return build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    ...[1, 3, 5].flatMap((at, index) => ringHolder(at, `R${index + 1}`, `p${index}`)),
    ...["R1", "R2", "R3"].map((name): Op => ({ op: "set_variable", name, alternatives: choices })),
  ])
}

const used = (picks: Array<ReturnType<typeof pickFields>>, name: string) => new Set(picks.map((fields) => fields[name]))

test("by default the first combinations come, the first variable stuck on its first choice; spread takes from all over", () => {
  const first = enumerate(many(), { limit: 25 })
  const fields = first.picks.map((picks) => pickFields(picks))
  assert.equal(first.molecules.length, 25)
  assert.equal(first.order, "first")
  assert.equal(used(fields, "R1").size, 1, "five and five and five: the first twenty-five leave R1 alone")
  assert.equal(first.total, 125)

  const spread = enumerate(many(), { limit: 25, order: "spread" })
  const spreadFields = spread.picks.map((picks) => pickFields(picks))
  assert.equal(spread.molecules.length, 25)
  assert.equal(spread.order, "spread")
  for (const name of ["R1", "R2", "R3"]) assert.equal(used(spreadFields, name).size, 5, `${name} goes through all its choices`)
  assert.equal(new Set(spreadFields.map((item) => JSON.stringify(item))).size, 25, "no combination twice")
  // And in the order the combinations come in, not the order they were picked.
  const sorted = enumerate(many(), { limit: 125 }).picks.map((picks) => JSON.stringify(pickFields(picks)))
  const places = spreadFields.map((item) => sorted.indexOf(JSON.stringify(item)))
  assert.deepEqual(places, places.slice().sort((a, b) => a - b))
})

test("spread picks the same compounds from the same formula every time, and all of them when there are not more than the limit", () => {
  const again = (limit: number) => enumerate(many(), { limit, order: "spread" })
  assert.deepEqual(again(30).picks, again(30).picks)
  const all = again(125)
  assert.deepEqual(all.molecules, enumerate(many(), { limit: 125 }).molecules)
  assert.equal(all.order, "first", "nothing was left out, so nothing was picked")
  assert.equal(enumerate(many(), { limit: 500, order: "spread" }).molecules.length, 125)
})

test("spread reaches every attachment placement and repeat count, not only the first ones", () => {
  const drawing = ringWith("naphthalene", [["R1", CH, { min: 0, max: 4 }], ["R2", CH, { min: 0, max: 2 }]])
  const made = enumerate(drawing, { limit: 200, order: "spread" })
  const fields = made.picks.map((picks) => pickFields(picks))
  assert.equal(made.molecules.length, 200)
  assert.ok(used(fields, "R1 position").size > 60, "most of the many placements of R1 turn up")
  assert.ok(used(fields, "R2 position").size > 30)
  assert.deepEqual([...used(fields, "R1")].sort(), ["Cl", "H", "Me", undefined].sort())
  const first = enumerate(drawing, { limit: 200 })
  assert.ok(used(first.picks.map((picks) => pickFields(picks)), "R1 position").size < 5, "the first two hundred hardly leave R1's first placements")
})

test("compounds that are repeats of one made are made up for by others", () => {
  // A toy identity that sees only how many atoms a compound has: many compounds are the same by it.
  const sameBy = (mol: Molecule) => `${mol.atoms.length}`
  const spread = enumerate(many(), { limit: 4, order: "spread", identity: sameBy })
  assert.equal(spread.molecules.length, 4, "the repeats do not leave fewer than asked for")
  assert.equal(new Set(spread.molecules.map(sameBy)).size, 4, "no two the same by the identity")
  assert.ok(spread.duplicates > 0)
})

test("compounds can be handed on as they are made, not held", () => {
  const seen: string[] = []
  const result = enumerate(many(), { limit: Infinity, onCompound: ({ picks, formula }) => seen.push(`${formula}:${JSON.stringify(pickFields(picks))}`) })
  assert.equal(result.molecules.length, 0)
  assert.equal(seen.length, 125)
  assert.deepEqual(seen.map((item) => item.slice(item.indexOf(":") + 1)), enumerate(many(), { limit: Infinity }).picks.map((picks) => JSON.stringify(pickFields(picks))))
})

test("a library of tens of millions is counted at once, and its first compounds come at once", () => {
  // Anthracene (ten CH): two attachments free to land on any of them, any number of times: 6 ways each to be (none, three, two).
  const drawing = ringWith("anthracene", [["R1", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], { min: 0, max: 14 }], ["R2", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], { min: 0, max: 14 }]])
  const started = performance.now()
  const size = librarySize(drawing)
  assert.equal(size.combinations, 6 ** 10)
  assert.equal(size.estimated, false)
  const made = enumerate(drawing, { limit: 20 })
  assert.equal(made.molecules.length, 20)
  assert.equal(made.total, 6 ** 10)
  assert.ok(performance.now() - started < 3000, "no layout was made for counting")
  const spread = enumerate(drawing, { limit: 20, order: "spread" })
  assert.equal(spread.molecules.length, 20)
})

test("stepping through a spread run is the same as running it", () => {
  const steps = enumerateSteps(many(), { limit: 12, order: "spread" })
  let step = steps.next()
  while (!step.done) step = steps.next()
  assert.deepEqual(step.value, enumerate(many(), { limit: 12, order: "spread" }))
})
