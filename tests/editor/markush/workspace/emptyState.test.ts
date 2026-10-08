import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import type { Drawing } from "@structura/core/types"
import { build, label } from "@structura/testkit"
import { emptyReason } from "../../../../src/editor/markush/workspace/emptyState.ts"

const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])

test("an empty canvas asks for a core structure first", () => {
  assert.equal(emptyReason(emptyDrawing())?.title, "画布上还没有结构")
})

test("a structure without variables asks for some", () => {
  assert.equal(emptyReason(benzene)?.title, "这个结构还没有变量")
  assert.equal(emptyReason({ ...benzene, variables: {}, attachments: [] })?.title, "这个结构还没有变量")
})

test("a variable, or a variable attachment, is enough to generate", () => {
  assert.equal(emptyReason({ ...benzene, variables: { R1: { alternatives: [label("Cl")] } } }), null)
  assert.equal(emptyReason({ ...benzene, attachments: [{}] } as unknown as Drawing), null)
})
