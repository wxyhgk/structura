import assert from "node:assert/strict"
import test from "node:test"
import type { Drawing } from "@structura/core/types"
import { alternativesFromText, enumerate, librarySize } from "@structura/markush"
import { build, label, run } from "@structura/testkit"

/** Benzene with R1 and R2 on neighbouring atoms. */
const pair = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r1" },
    { op: "label", atom: "r1", text: "R1" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Me"), { kind: "class", class: "alkyl", min: 1, max: 4 }] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("F"), { kind: "class", class: "aryl", min: 6, max: 10 }] },
  ])

/** Benzene with (R1)m, m 0–2, and –L–Ar attached to atoms 1–3; and a second formula, R1 on cyclohexane. */
const crowded = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "C", at: { x: 150, y: 0 } },
    { op: "label", atom: 7, text: "R1" },
    { op: "set_attachment", atom: 7, to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 2, name: "m" } },
    { op: "place_atom", el: "C", at: { x: 250, y: 0 } },
    { op: "label", atom: 8, text: "L" },
    { op: "add_atom", el: "C", to: 8, as: "ar" },
    { op: "label", atom: "ar", text: "Ar" },
    { op: "set_attachment", atom: 8, to: [1, 2, 3] },
    { op: "add_ring", at: { x: 600, y: 0 }, kind: "cyclohexane", as: "c" },
    { op: "add_atom", el: "C", to: "c", as: "s" },
    { op: "label", atom: "s", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), { kind: "class", class: "alkoxy" }] },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bond" }, label("O"), { kind: "class", class: "arylene" }] },
    { op: "set_variable", name: "Ar", alternatives: [label("Ph"), { kind: "class", class: "heteroaryl" }] },
  ])

const drawings: Array<[string, () => Drawing]> = [
  ["two placeholders with classes", pair],
  ["a ring closure", () => run(pair(), [{ op: "set_ring_closure", closure: { a: "R1", b: "R2", ring: alternativesFromText("(CH2)3-4").add } }])],
  ["repeats, an attachment and two formulas", crowded],
  [
    "a repeat unit [ … ]n beside them",
    () => {
      const start = crowded()
      const first = start.molecule.nextAtomId
      return run(start, [
        { op: "draw_chain", points: [{ x: 0, y: 300 }, { x: 35, y: 280 }, { x: 70, y: 300 }] },
        { op: "label", atom: first, text: "R1" },
        { op: "add_bracket", atoms: [first + 1], kind: "repeat", repeat: { min: 1, max: 3, name: "n" } },
      ])
    },
  ],
  ["only classes", () => run(pair(), [{ op: "set_variable", name: "R2", alternatives: [{ kind: "class", class: "aryl", min: 6, max: 30 }] }])],
]

test("the library size is what enumerate() counts, with and without representatives", () => {
  for (const [what, drawing] of drawings) {
    for (const representatives of [true, false]) {
      const size = librarySize(drawing(), { representatives })
      const made = enumerate(drawing(), { limit: 0, representatives })
      assert.deepEqual(
        size,
        { combinations: made.total, represented: made.represented, classesLeftOut: made.classesLeftOut, onlyClasses: made.onlyClasses, skippedRepeats: made.skippedRepeats },
        `${what}, representatives ${representatives}`,
      )
    }
  }
})
