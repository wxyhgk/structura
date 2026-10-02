import assert from "node:assert/strict"
import test from "node:test"
import type OpenAI from "openai"
import { askOpenAI, OPENAI_MODEL } from "../src/openai.ts"
import { SYSTEM_PROMPT } from "../src/prompt.ts"
import { providerFrom } from "../src/provider.ts"
import { ANSWER_SCHEMA } from "../src/schema.ts"
import type { FillAnswer, FillRequest } from "../src/types.ts"

const request: FillRequest = { text: "X 为 O 或 S。", variables: [{ name: "X", linker: false, onDrawing: true, current: null }] }

/** A client whose responses.create() hands back `reply` and records what it was asked. */
function fakeClient(reply: unknown) {
  const calls: unknown[] = []
  const client = { responses: { create: async (params: unknown) => (calls.push(params), reply) } } as unknown as OpenAI
  return { client, calls }
}

const message = (content: unknown[]) => [{ type: "message", content }]

test("the Responses API is asked for strict JSON in the schema, with the prompt as instructions and nothing stored", async () => {
  const answer: FillAnswer = { variables: [], notes: [] }
  const text = JSON.stringify(answer)
  const { client, calls } = fakeClient({ status: "completed", output: message([{ type: "output_text", text }]), output_text: text })
  assert.deepEqual(await askOpenAI(client, request, "some-model"), { ok: true, answer })
  const params = calls[0] as Record<string, any>
  assert.equal(params.model, "some-model")
  assert.equal(params.instructions, SYSTEM_PROMPT)
  assert.match(params.input, /X 为 O 或 S/)
  assert.equal(params.store, false)
  assert.deepEqual(params.text.format, { type: "json_schema", name: "variable_definitions", schema: ANSWER_SCHEMA, strict: true })
})

test("a refusal or an unfinished answer is reported, not parsed", async () => {
  const refused = fakeClient({ status: "completed", output: message([{ type: "refusal", refusal: "no" }]), output_text: "" })
  assert.equal((await askOpenAI(refused.client, request)).ok, false)
  const cut = fakeClient({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [], output_text: "{" })
  assert.deepEqual(await askOpenAI(cut.client, request), { ok: false, error: "回答太长被截断了，请分几段粘贴。" })
})

test("the provider follows AI_PROVIDER, or the only key that is set", () => {
  const pick = (env: Record<string, string>) => {
    const provider = providerFrom(env)
    return "error" in provider ? provider.error : `${provider.name} ${provider.model}`
  }
  assert.equal(pick({}), "anthropic claude-opus-5-5")
  assert.equal(pick({ OPENAI_API_KEY: "k" }), `openai ${OPENAI_MODEL}`)
  assert.equal(pick({ OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k" }), "anthropic claude-opus-5-5")
  assert.equal(pick({ AI_PROVIDER: "OpenAI", OPENAI_MODEL: "my-model" }), "openai my-model")
  assert.match(pick({ AI_PROVIDER: "gemini" }), /只能是 anthropic 或 openai/)
})

test("OpenAI without a key says so instead of failing obscurely", async () => {
  const saved = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const provider = providerFrom({ AI_PROVIDER: "openai" })
    assert.ok(!("error" in provider))
    const result = await provider.ask(request)
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /OPENAI_API_KEY/)
  } finally {
    if (saved != null) process.env.OPENAI_API_KEY = saved
  }
})

test("any server speaking the Responses API at OPENAI_BASE_URL is used, with the key as a bearer token", async () => {
  const { createServer } = await import("node:http")
  const answer: FillAnswer = { variables: [], notes: ["ok"] }
  let seen: { url?: string; auth?: string; body?: Record<string, unknown> } = {}
  const server = createServer(async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    seen = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) }
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ id: "resp_1", object: "response", status: "completed", model: "local", output: [{ type: "message", id: "m1", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(answer), annotations: [] }] }] }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const { port } = server.address() as { port: number }
    const provider = providerFrom({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-local", OPENAI_BASE_URL: `http://127.0.0.1:${port}/v1`, OPENAI_MODEL: "local" })
    assert.ok(!("error" in provider))
    assert.deepEqual(await provider.ask(request), { ok: true, answer })
    assert.equal(seen.url, "/v1/responses")
    assert.equal(seen.auth, "Bearer sk-local")
    assert.equal(seen.body?.model, "local")
  } finally {
    server.close()
  }
})
