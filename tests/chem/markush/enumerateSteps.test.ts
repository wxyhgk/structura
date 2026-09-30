import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "../../../src/chem/drawing.ts"
import { enumerate, enumerateSteps } from "../../../src/chem/markush/enumerate.ts"
import { applyOps, type Op } from "../../../src/chem/ops.ts"
import type { Drawing, Molecule } from "../../../src/chem/types.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing
}

const label = (text: string) => ({ kind: "label" as const, text })

/** Benzene with R2 on atom 2, and –L–ETU attached to any of atoms 1–3; Me cannot be a linker. */
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
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("F"), { kind: "class", class: "alkyl", min: 1, max: 4 }] },
    { op: "set_variable", name: "L", alternatives: [label("O"), label("S"), label("Me")] },
    { op: "set_variable", name: "ETU", alternatives: [label("Ph"), label("Me")] },
  ])
}

test("stepping through builds the same molecules, counts and notes as enumerate()", () => {
  for (const options of [{}, { representatives: true }, { limit: 7 }]) {
    const whole = enumerate(formula(), options)
    const steps = enumerateSteps(formula(), options)
    const seen: Molecule[] = []
    let step = steps.next()
    for (; !step.done; step = steps.next()) seen.push(...step.value.molecules.slice(seen.length))
    assert.deepEqual(step.value, whole)
    assert.deepEqual(seen, whole.molecules, "molecules arrive in order, as they are made")
  }
})

test("the total is known before any molecule is built, and stopping keeps what was made", () => {
  const whole = enumerate(formula(), { representatives: true })
  assert.ok(whole.molecules.length > 10)
  const steps = enumerateSteps(formula(), { representatives: true })
  let step = steps.next()
  while (!step.done && step.value.molecules.length === 0) step = steps.next()
  assert.ok(!step.done)
  assert.equal(step.value.total, whole.total)
  assert.deepEqual(step.value.misfits, whole.misfits)
  while (!step.done && step.value.molecules.length < 4) step = steps.next()
  const partial = step.value
  steps.return(partial)
  assert.deepEqual(partial.molecules, whole.molecules.slice(0, 4))
})
