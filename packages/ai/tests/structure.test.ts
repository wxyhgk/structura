import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "@structura/core/formula"
import { MOST_STEPS, recognize } from "../src/structure/agent.ts"
import { firstObject } from "../src/structure/json.ts"
import { createSession } from "../src/structure/session.ts"
import type { Action, StructureStep, Turn } from "../src/structure/types.ts"
import { structureProblem } from "../src/structure/types.ts"

const build = (ops: unknown[], note = "搭"): Action => ({ note, action: "build", ops: JSON.stringify(ops) })
const PICTURE = "data:image/png;base64,iVBORw0KGgo="

test("a session builds all or nothing, keeps the names it was given for later builds, and reset starts over", () => {
  const session = createSession()
  const first = session.act(build([{ op: "add_scaffold", name: "carbazole", as: "cz" }]))
  assert.ok(first.ok)
  assert.match(first.message, /\d+ N \((?:cz\.N9)\)/, "each atom shows its names")
  assert.match(first.message, /Formula C12H9N/)
  // A later build still knows cz.N9.
  const later = session.act(build([{ op: "add_scaffold", name: "benzene", site: "C1", to: "cz.N9", as: "ph" }]))
  assert.ok(later.ok, later.message)
  assert.equal(plainFormula(session.drawing().molecule), "C18H13N")
  assert.match(later.message, /ph\.C1/)
  const bad = session.act(build([{ op: "add_atom", el: "C", to: "nobody" }]))
  assert.equal(bad.ok, false)
  assert.match(bad.message, /Nothing changed/)
  assert.equal(session.act({ note: "", action: "build", ops: "not json" }).ok, false)
  session.act({ note: "", action: "reset", ops: "" })
  assert.equal(session.drawing().molecule.atoms.length, 0)
})

test("the answer's first whole JSON object is taken, even when another follows", () => {
  assert.deepEqual(firstObject('{"a":1,"b":"}{"}{"a":2}'), { a: 1, b: "}{" })
  assert.deepEqual(firstObject('sure: {"x":[1,{"y":2}]} ok'), { x: [1, { y: 2 }] })
  assert.throws(() => firstObject("no json"))
  assert.throws(() => firstObject('{"cut":'))
})

test("the loop acts step by step, shows the model its drawing on look, and ends on done", async () => {
  const script: Action[] = [
    build([{ op: "add_scaffold", name: "benzene" }]),
    { note: "看", action: "look", ops: "" },
    { note: "好了", action: "done", ops: "" },
  ]
  const seen: Turn[][] = []
  const steps: StructureStep[] = []
  const result = await recognize({ image: PICTURE }, async (turns) => (seen.push(turns.map((turn) => ({ ...turn }))), script[seen.length - 1]), (step) => steps.push(step))
  assert.ok(result.ok)
  assert.equal(plainFormula(result.ok ? result.drawing.molecule : steps[0].drawing.molecule), "C6H6")
  assert.deepEqual(steps.map((step) => step.action), ["build", "look", "done"])
  assert.deepEqual(seen[0][0].images, [PICTURE], "the first turn carries the picture")
  const afterLook = seen[2].at(-1)!
  assert.ok(afterLook.images?.[0].startsWith("data:image/png;base64,"), "look sends the rendering back")
})

test("a model that never says done stops after the step limit, keeping what it built", async () => {
  let calls = 0
  const result = await recognize({ image: PICTURE }, async () => (calls++, calls === 1 ? build([{ op: "add_scaffold", name: "pyridine" }]) : { note: "", action: "look", ops: "" }), () => {})
  assert.equal(calls, MOST_STEPS)
  assert.ok(result.ok)
})

test("an API failure or a stop ends the run with what was built", async () => {
  const failed = await recognize({ image: PICTURE }, async () => {
    throw new Error("网关忙")
  }, () => {})
  assert.deepEqual(failed.ok ? null : failed.error, "网关忙")
  const stop = new AbortController()
  stop.abort()
  const stopped = await recognize({ image: PICTURE }, async () => build([]), () => {}, stop.signal)
  assert.equal(stopped.ok, false)
})

test("pictures from the browser are checked before anything is sent", () => {
  assert.equal(structureProblem({ image: PICTURE }), null)
  assert.ok(structureProblem({ image: "data:text/plain;base64,aGk=" }))
  assert.ok(structureProblem({ image: PICTURE, hint: "x".repeat(3000) }))
  assert.ok(structureProblem(null))
})

test("done is refused while an atom is over-full", async () => {
  const script: Action[] = [
    build([{ op: "add_atom", el: "C", as: "c" }, ...[1, 2, 3, 4, 5].map(() => ({ op: "add_atom", el: "C", to: "c" }))]),
    { note: "", action: "done", ops: "" },
    { note: "", action: "reset", ops: "" },
    build([{ op: "add_atom", el: "C" }]),
    { note: "", action: "done", ops: "" },
  ]
  const steps: StructureStep[] = []
  let at = 0
  const result = await recognize({ image: PICTURE }, async () => script[at++], (step) => steps.push(step))
  assert.equal(steps[1].ok, false)
  assert.match(steps[1].message, /valence/)
  assert.ok(result.ok)
  assert.equal(at, 5)
})

test("ops sent as an array rather than a string are accepted", () => {
  const session = createSession()
  const answer = session.act({ note: "", action: "build", ops: [{ op: "add_scaffold", name: "benzene" }] as unknown as string })
  assert.ok(answer.ok, answer.message)
})
