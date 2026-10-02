import assert from "node:assert/strict"
import test from "node:test"
import type Anthropic from "@anthropic-ai/sdk"
import { requestProblem } from "../src/check.ts"
import { askClaude, CLAUDE_MODEL } from "../src/claude.ts"
import { SYSTEM_PROMPT, userMessage } from "../src/prompt.ts"
import { ANSWER_SCHEMA } from "../src/schema.ts"
import type { FillAnswer, FillRequest } from "../src/types.ts"

const request: FillRequest = { text: "X 为 O 或 S。", variables: [{ name: "X", linker: false, onDrawing: true, current: null }] }

/** A client whose create() hands back `reply` and records what it was asked. */
function fakeClient(reply: unknown) {
  const calls: unknown[] = []
  const client = { beta: { messages: { create: async (params: unknown) => (calls.push(params), reply) } } } as unknown as Anthropic
  return { client, calls }
}

test("the answer is asked for in the schema, with the stable prompt cached and the text in the user turn", async () => {
  const answer: FillAnswer = { variables: [], notes: [] }
  const { client, calls } = fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answer) }] })
  assert.deepEqual(await askClaude(client, request), { ok: true, answer })
  const params = calls[0] as Record<string, any>
  assert.equal(params.model, CLAUDE_MODEL)
  assert.equal(params.fallbacks, "default")
  assert.deepEqual(params.output_config.format, { type: "json_schema", schema: ANSWER_SCHEMA })
  assert.equal(params.system[0].text, SYSTEM_PROMPT)
  assert.deepEqual(params.system[0].cache_control, { type: "ephemeral" })
  assert.match(params.messages[0].content, /X 为 O 或 S/)
})

test("a refusal or a cut-off answer is reported, not parsed", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const { client } = fakeClient({ stop_reason, content: [] })
    const result = await askClaude(client, request)
    assert.equal(result.ok, false, stop_reason)
  }
})

test("the system prompt names every class, bridge and abbreviation the editor knows", () => {
  for (const word of ["alkyl", "heteroarylene", "p-phenylene", "2,5-pyridinediyl", "tBu", "Boc", "Ph"]) assert.ok(SYSTEM_PROMPT.includes(word), word)
  assert.ok(!SYSTEM_PROMPT.includes("X 为"), "the request's own text stays out of the cached part")
  assert.match(userMessage(request), /- X \(a substituent\)/)
})

test("every object in the schema is closed and lists all its properties as required", () => {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (typeof node !== "object" || node === null) return
    const schema = node as Record<string, unknown>
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false)
      assert.deepEqual(schema.required, Object.keys(schema.properties as object))
    }
    Object.values(schema).forEach(visit)
  }
  visit(ANSWER_SCHEMA)
})

test("requests from the browser are checked before anything is sent", () => {
  assert.equal(requestProblem(request), null)
  assert.ok(requestProblem(null))
  assert.ok(requestProblem({ text: "", variables: [] }))
  assert.ok(requestProblem({ text: "x".repeat(300_000), variables: [] }))
  assert.ok(requestProblem({ text: "x", variables: [{ name: 1 }] }))
})
