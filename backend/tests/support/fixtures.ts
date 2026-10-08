import assert from "node:assert/strict"
import { applyOps, emptyDrawing, type Op } from "@structura/core"
import type { Template, TemplateInput } from "@structura/markush"

type Alternative = TemplateInput["alternative"]

// Templates to store in the tests, with real drawn pieces made by core's ops.

const piece = (ops: Op[]): Alternative => {
  const result = applyOps(emptyDrawing(), ops)
  assert.ok(result.ok)
  return { kind: "fragment", molecule: result.drawing.molecule }
}

/** Phenyl: benzene with one "*". */
export const phenyl = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "s" },
    { op: "label", atom: "s", text: "*" },
  ])

/** p-Phenylene: a "*" on atoms 1 and 4. */
export const phenylene = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "label", atom: "a", text: "*" },
    { op: "add_atom", el: "C", to: 4, as: "b" },
    { op: "label", atom: "b", text: "*" },
  ])

export const phenylTemplate = (change: Partial<TemplateInput> = {}): TemplateInput => ({ name: "苯基", aliases: ["Ph"], group: "芳基", site: "end", alternative: phenyl(), ...change })

export const alkylTemplate = (change: Partial<TemplateInput> = {}): TemplateInput => ({
  name: "C1–C6 烷基",
  group: "烷基",
  site: "end",
  alternative: { kind: "class", class: "alkyl", min: 1, max: 6 },
  ...change,
})

/** A stored-looking template, as a library file holds it. */
export const stamped = (input: TemplateInput, id: string, createdAt = "2025-01-02T03:04:05.000Z"): Template => ({
  ...input,
  id,
  source: "user",
  createdAt,
  updatedAt: createdAt,
})
