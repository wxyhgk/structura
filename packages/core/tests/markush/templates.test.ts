import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "../../src/drawing.ts"
import { libraryProblem, templateProblem, type TemplateInput } from "../../src/markush.ts"
import { applyOps, type Op } from "../../src/ops.ts"
import type { Alternative } from "../../src/types.ts"

const piece = (ops: Op[]): Alternative => {
  const result = applyOps(emptyDrawing(), ops)
  assert.ok(result.ok)
  return { kind: "fragment", molecule: result.drawing.molecule }
}
/** Phenyl: benzene with one "*". */
const phenyl = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "s" },
    { op: "label", atom: "s", text: "*" },
  ])
/** p-Phenylene: a "*" on atoms 1 and 4. */
const phenylene = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "label", atom: "a", text: "*" },
    { op: "add_atom", el: "C", to: 4, as: "b" },
    { op: "label", atom: "b", text: "*" },
  ])

const template = (change: Partial<TemplateInput> = {}): TemplateInput => ({ name: "苯基", group: "芳基", site: "end", alternative: phenyl(), ...change })

test("a template is a named alternative that suits its site", () => {
  assert.equal(templateProblem(template()), null)
  assert.equal(templateProblem(template({ name: "对亚苯基", site: "link", alternative: phenylene() })), null)
  assert.equal(templateProblem(template({ name: "C1–C6 烷基", alternative: { kind: "class", class: "alkyl", min: 1, max: 6 } })), null)
  // –C(=O)– joins two atoms by one atom bonded twice: a linker as well as a ring atom.
  const carbonyl = piece([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "O", to: 1, order: 2 },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "label", atom: "a", text: "*" },
    { op: "add_atom", el: "C", to: 1, as: "b" },
    { op: "label", atom: "b", text: "*" },
  ])
  assert.equal(templateProblem(template({ name: "羰基", site: "link", alternative: carbonyl })), null)
  assert.equal(templateProblem(template({ name: "羰基", site: "ring", alternative: carbonyl })), null)
})

test("a template's piece must match where it stands", () => {
  assert.match(templateProblem(template({ site: "link" })) ?? "", /two atoms/)
  assert.match(templateProblem(template({ alternative: phenylene() })) ?? "", /one \*/)
  assert.match(templateProblem(template({ site: "ring" })) ?? "", /one atom/)
  assert.match(templateProblem(template({ alternative: { kind: "bond" } })) ?? "", /links two atoms/)
})

test("a template needs a name and a group of sensible length", () => {
  assert.ok(templateProblem(template({ name: "  " })))
  assert.ok(templateProblem(template({ group: "x".repeat(31) })))
  assert.ok(templateProblem(template({ aliases: ["", "Ph"] })))
  assert.ok(templateProblem(template({ site: "anywhere" as never })))
})

test("a library file names its format and version, and every template in it is checked", () => {
  const stamped = { ...template(), id: "a", source: "user" as const, createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z" }
  assert.equal(libraryProblem({ format: "structura-templates", version: 1, templates: [stamped] }), null)
  assert.ok(libraryProblem({ format: "other", version: 1, templates: [] } as never))
  assert.ok(libraryProblem({ format: "structura-templates", version: 2, templates: [] } as never))
  assert.match(libraryProblem({ format: "structura-templates", version: 1, templates: [{ ...stamped, site: "link" }] }) ?? "", /template 1/)
})
